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
    // Check if pool wallet is configured
    if (!poolWallet.isConfigured()) {
      // For development/demo purposes only - return mock data if not configured
      return res.json({
        totalPool: 10,
        uploadPoolPercentage: 70,
        likePoolPercentage: 30,
        dailyDistribution: 0.1,
        poolAddress: '',
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
    res.status(500).json({ error: error.message });
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
 * Process an upvote payment
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
    
    // Process the upvote payment
    const result = await poolWallet.processUpvote(
      fromWallet,
      privateKey,
      creatorWallet,
      contentId,
      amount || 0.01
    );
    
    if (result.success) {
      // Record the payment in storage
      await storage.addLike({
        walletAddress: fromWallet,
        contentId
      });
      
      res.json({
        success: true,
        message: 'Payment processed successfully',
        creatorTx: result.creatorTx,
        poolTx: result.poolTx
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Unknown error processing payment'
      });
    }
  } catch (error: any) {
    log(`Error processing upvote: ${error.message}`, 'rewardRoutes');
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin endpoint to distribute rewards to creators
 * In a production environment, this would be secured and/or automated
 */
router.post('/distribute-rewards', async (req: Request, res: Response) => {
  try {
    // Check if pool wallet is configured
    if (!poolWallet.isConfigured()) {
      return res.status(400).json({ 
        error: 'Pool wallet not configured. Please set POOL_WALLET_ADDRESS and POOL_WALLET_PRIVATE_KEY environment variables.' 
      });
    }
    
    // Get the distribution list from the request or generate automatically
    let { creators } = req.body;
    
    if (!creators || !Array.isArray(creators) || creators.length === 0) {
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
        return res.status(400).json({ 
          error: 'No content creators found for distribution' 
        });
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
      creators = Object.entries(scores).map(([wallet, score]) => {
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
      }).filter(Boolean);
    }
    
    // Validate creators format
    if (!creators || creators.length === 0) {
      return res.status(400).json({ 
        error: 'No valid creators found for distribution' 
      });
    }
    
    // Process distribution
    const results = await poolWallet.distributeRewards(creators);
    
    res.json({
      success: true,
      distributions: results,
      totalDistributed: results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.amount, 0)
    });
  } catch (error: any) {
    log(`Error distributing rewards: ${error.message}`, 'rewardRoutes');
    res.status(500).json({ error: error.message });
  }
});

export default router;