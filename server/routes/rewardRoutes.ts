/**
 * Reward Pool Routes
 * API endpoints for the Self-Sustained Model reward pool
 */

import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { poolWallet } from '../utils/poolWallet';
import { log } from '../vite';

const router = express.Router();

/**
 * Get reward pool statistics
 */
router.get('/pool-stats', async (req: Request, res: Response) => {
  try {
    // Always use real blockchain data, no mocks
    if (!poolWallet.isConfigured()) {
      // If not configured, return zeros but with error flag
      return res.json({
        totalPool: 0,
        uploadPoolPercentage: 70,
        likePoolPercentage: 30,
        dailyDistribution: 0.1,
        poolAddress: '',
        error: 'Pool wallet not configured. Please set PUBLIC_POOL_ADDRESS and POOL_PRIVATE_KEY in Replit secrets.'
      });
    }
    
    // Get real pool stats from the blockchain
    const stats = await poolWallet.getPoolStats();
    res.json({
      ...stats,
      poolAddress: poolWallet.getPoolAddress()
    });
  } catch (error: any) {
    log(`Error getting pool stats: ${error.message}`, 'rewardRoutes');
    res.status(500).json({ 
      error: error.message,
      totalPool: 0,
      uploadPoolPercentage: 70,
      likePoolPercentage: 30,
      dailyDistribution: 0.1,
      uploadPool: 0,
      likePool: 0,
      totalUploads: 0,
      totalLikes: 0,
      estimatedEarnings: 0,
      poolAddress: poolWallet.getPoolAddress() || ''
    });
  }
});

/**
 * Get estimated earnings for a wallet
 */
router.post('/estimated-earnings', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    const estimatedEarnings = await storage.getEstimatedEarnings(walletAddress);
    res.json({ estimatedEarnings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process an upvote payment with the 80/20 Self-Sustained Model
 *
 * How it works:
 * 1. User makes an upvote payment through wallet interface
 * 2. 80% of the payment goes to the content creator
 * 3. 20% of the payment goes to the reward pool
 * 4. Transaction details are recorded in the likes table
 * 5. Corresponding payment records are created
 */
router.post('/process-upvote', async (req: Request, res: Response) => {
  try {
    const { fromWallet, privateKey, creatorWallet, contentId, amount } = req.body;
    
    if (!fromWallet || !privateKey || !creatorWallet || !contentId) {
      return res.status(400).json({ 
        error: 'Required fields missing: fromWallet, privateKey, creatorWallet, contentId' 
      });
    }
    
    // Validate content exists
    const content = await storage.getContent(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Check if user already upvoted this content
    const alreadyLiked = await storage.hasLiked(contentId, fromWallet);
    if (alreadyLiked) {
      return res.status(400).json({ error: 'You have already upvoted this content' });
    }
    
    // Process the upvote payment - implements the 80/20 split
    const upvoteAmount = amount || 0.01;
    log(`Processing upvote of ${upvoteAmount} XNO from ${fromWallet} to ${creatorWallet} for content #${contentId}`, 'rewardRoutes');
    
    const result = await poolWallet.processUpvote(
      fromWallet,
      privateKey,
      creatorWallet,
      contentId,
      upvoteAmount
    );
    
    if (result.success) {
      // Record the like with payment details
      await storage.addLike({
        walletAddress: fromWallet,
        contentId,
        creatorWallet,
        amountPaid: upvoteAmount.toString(),
        creatorTxHash: result.creatorTx,
        poolTxHash: result.poolTx
      });
      
      log(`Successfully processed upvote payment: ${upvoteAmount} XNO`, 'rewardRoutes');
      log(`- Creator (${creatorWallet}) received: ${result.creatorAmount} XNO (80%)`, 'rewardRoutes');
      log(`- Pool received: ${result.poolAmount} XNO (20%)`, 'rewardRoutes');
      
      res.json({
        success: true,
        message: 'Upvote payment processed successfully',
        creatorTx: result.creatorTx,
        poolTx: result.poolTx,
        amountPaid: upvoteAmount,
        creatorAmount: result.creatorAmount,
        poolAmount: result.poolAmount
      });
    } else {
      log(`Failed to process upvote payment: ${result.error}`, 'rewardRoutes');
      res.status(400).json({
        success: false,
        error: result.error || 'Unknown error processing upvote payment'
      });
    }
  } catch (error: any) {
    log(`Error processing upvote: ${error.message}`, 'rewardRoutes');
    res.status(500).json({ error: error.message });
  }
});

/**
 * Distribute rewards to creators - exported for scheduled distributions
 */
export async function distributeRewards() {
  try {
    // Check if pool wallet is configured
    if (!poolWallet.isConfigured()) {
      log('Pool wallet not configured. Cannot distribute rewards.', 'rewardDistribution');
      return {
        success: false,
        error: 'Pool wallet not configured'
      };
    }
    
    // Auto-generate distribution based on content engagement
    const allContent = await storage.getAllContent();
    
    // Group content by wallet address
    const walletContributions: Record<string, { contentCount: number, likeCount: number }> = {};
    
    for (const content of allContent) {
      if (!walletContributions[content.walletAddress]) {
        walletContributions[content.walletAddress] = { contentCount: 0, likeCount: 0 };
      }
      
      // Count content
      walletContributions[content.walletAddress].contentCount += 1;
      
      // Get likes for this content
      const likes = await storage.getLikesByContent(content.id);
      walletContributions[content.walletAddress].likeCount += likes.length;
    }
    
    // Calculate distribution amounts
    const availableDistribution = poolWallet.getAvailableDistribution();
    
    // If no content or engagement, return early
    if (Object.keys(walletContributions).length === 0) {
      log('No content creators found for distribution', 'rewardDistribution');
      return {
        success: false,
        error: 'No content creators found for distribution'
      };
    }
    
    // Calculate total contribution score (70% for content, 30% for likes)
    let totalScore = 0;
    const scores: Record<string, number> = {};
    
    for (const [wallet, stats] of Object.entries(walletContributions)) {
      const score = (stats.contentCount * 0.7) + (stats.likeCount * 0.3);
      scores[wallet] = score;
      totalScore += score;
    }
    
    // Distribute proportionally
    const creators = Object.entries(scores)
      .map(([wallet, score]) => {
        const proportion = score / totalScore;
        const amount = availableDistribution * proportion;
        
        // Only include if meaningful amount (min 0.0001 XNO)
        if (amount >= 0.0001) {
          return {
            walletAddress: wallet,
            amount: parseFloat(amount.toFixed(4))
          };
        }
        return null;
      })
      .filter((item): item is { walletAddress: string; amount: number } => item !== null);
    
    // Validate creators format
    if (!creators || creators.length === 0) {
      log('No valid creators found for distribution', 'rewardDistribution');
      return {
        success: false,
        error: 'No valid creators found for distribution'
      };
    }
    
    // Process distribution
    const results = await poolWallet.distributeRewards(creators);
    
    const totalDistributed = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.amount, 0);
      
    log(`Successfully distributed ${totalDistributed} XNO to ${results.filter(r => r.success).length} creators`, 'rewardDistribution');
    
    return {
      success: true,
      distributions: results,
      totalDistributed
    };
  } catch (error: any) {
    log(`Error distributing rewards: ${error.message}`, 'rewardDistribution');
    return {
      success: false,
      error: error.message
    };
  }
}

export default router;