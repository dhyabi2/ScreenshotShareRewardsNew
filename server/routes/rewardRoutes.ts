/**
 * Reward Pool Routes
 * API endpoints for the Self-Sustained Model reward pool
 */

import { Router, Request, Response } from 'express';
import { poolWallet } from '../utils/poolWallet';
import { storage } from '../storage';
import { log } from '../vite';

const router = Router();

/**
 * Get reward pool statistics
 */
router.get('/pool-stats', async (req: Request, res: Response) => {
  try {
    const stats = await poolWallet.getPoolStats();
    res.json(stats);
  } catch (error) {
    log(`Error getting pool stats: ${error}`, 'rewardRoutes');
    res.status(500).json({ error: 'Failed to retrieve pool statistics' });
  }
});

/**
 * Get estimated earnings for a wallet
 */
router.post('/estimated-earnings', async (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  try {
    const estimatedEarnings = await storage.getEstimatedEarnings(walletAddress);
    res.json({ estimatedEarnings });
  } catch (error) {
    log(`Error calculating estimated earnings: ${error}`, 'rewardRoutes');
    res.status(500).json({ error: 'Failed to calculate estimated earnings' });
  }
});

/**
 * Process an upvote payment
 */
router.post('/process-upvote', async (req: Request, res: Response) => {
  const { 
    fromWallet, 
    fromPrivateKey,
    creatorWallet, 
    contentId, 
    amount = 0.01 // Default 0.01 XNO per upvote
  } = req.body;
  
  if (!fromWallet || !fromPrivateKey || !creatorWallet || !contentId) {
    return res.status(400).json({ 
      error: 'Missing required fields (fromWallet, fromPrivateKey, creatorWallet, contentId)' 
    });
  }
  
  try {
    const result = await poolWallet.processUpvote(
      fromWallet,
      fromPrivateKey,
      creatorWallet,
      contentId,
      amount
    );
    
    if (result.success) {
      // Record like in database
      await storage.addLike({
        contentId,
        walletAddress: fromWallet,
        timestamp: new Date(),
        amount: amount,
      });
      
      res.json({ 
        success: true,
        creatorTx: result.creatorTx,
        poolTx: result.poolTx
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log(`Error processing upvote: ${error}`, 'rewardRoutes');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error during upvote processing'
    });
  }
});

/**
 * Admin endpoint to distribute rewards to creators
 * In a production environment, this would be secured and/or automated
 */
router.post('/distribute-rewards', async (req: Request, res: Response) => {
  // In a real implementation, this would be secured with admin authorization
  const { rewards } = req.body;
  
  if (!Array.isArray(rewards) || rewards.length === 0) {
    return res.status(400).json({ error: 'Valid rewards array is required' });
  }
  
  try {
    const results = await poolWallet.distributeRewards(rewards);
    res.json({ results });
  } catch (error) {
    log(`Error distributing rewards: ${error}`, 'rewardRoutes');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to distribute rewards'
    });
  }
});

export default router;