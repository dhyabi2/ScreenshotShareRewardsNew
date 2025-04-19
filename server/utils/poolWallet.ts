/**
 * Pool Wallet Service
 * Handles the community reward pool for the Self-Sustained Model
 * Uses a dedicated XNO wallet to manage the 10 XNO initial pool and subsequent rewards
 */

import { nanoTransactions } from './nanoTransactions';
import { log } from '../vite';

interface PoolStats {
  totalPool: number;         // Total amount in pool in raw XNO
  uploadPoolPercentage: number;  // Percentage allocated to content uploads
  likePoolPercentage: number;    // Percentage allocated to content likes
  dailyDistribution: number;     // Amount distributed daily
}

interface RewardDistribution {
  walletAddress: string;
  amount: number;
  success: boolean;
  txHash?: string;
  error?: string;
}

class PoolWallet {
  private poolAddress: string;
  private poolPrivateKey: string;
  
  // Default distribution settings
  private readonly defaultStats: PoolStats = {
    totalPool: 0,               // 0 XNO initial pool (real balance from blockchain)
    uploadPoolPercentage: 70,   // 70% for content uploads 
    likePoolPercentage: 30,     // 30% for content likes
    dailyDistribution: 0.1      // 0.1 XNO distributed daily
  };
  
  // Cache for pool stats
  private poolStats: PoolStats = this.defaultStats;
  private lastUpdated: Date = new Date();
  
  constructor() {
    log('Initializing pool wallet from Replit secrets...', 'poolWallet');
    
    // Initialize with dedicated pool wallet Replit secrets
    const poolAddress = process.env.PUBLIC_POOL_ADDRESS || '';
    const poolPrivateKey = process.env.POOL_PRIVATE_KEY || '';
    
    // Debug available environment variables (without showing actual values)
    const envKeys = Object.keys(process.env);
    log(`Available environment variables: ${envKeys.join(', ')}`, 'poolWallet');
    
    // Check if we have proper nano addresses (nano_...)
    const isValidPoolAddress = poolAddress.startsWith('nano_') && poolAddress.length > 60;
    const isValidPoolPrivateKey = poolPrivateKey.length >= 64; // Check private key length
    
    // Ensure the secrets are properly loaded from Replit
    if (!isValidPoolAddress || !isValidPoolPrivateKey) {
      log('⚠️ Pool wallet secrets not found or invalid. The application requires PUBLIC_POOL_ADDRESS and POOL_PRIVATE_KEY to be set as Replit secrets.', 'poolWallet');
      log(`PUBLIC_POOL_ADDRESS is valid format: ${isValidPoolAddress}`, 'poolWallet');
      log(`POOL_PRIVATE_KEY is valid format: ${isValidPoolPrivateKey}`, 'poolWallet');
      
      // Try to handle the case by checking if we're in a development environment
      if (process.env.NODE_ENV === 'development') {
        log('Development environment detected. Using fallback values.', 'poolWallet');
        // Use a development fallback wallet address for testing
        this.poolAddress = 'nano_3sho393cso6ewdz8adndh16ssdzhkxztodjweatc3or34utkaydus4fmftj6';
        this.poolPrivateKey = '';
      } else {
        // In production, we must have these values
        throw new Error('Missing or invalid Replit secrets: PUBLIC_POOL_ADDRESS and POOL_PRIVATE_KEY');
      }
    } else {
      // Set the values from Replit secrets
      this.poolAddress = poolAddress;
      this.poolPrivateKey = poolPrivateKey;
      log(`✅ Pool wallet successfully initialized with address: ${this.poolAddress}`, 'poolWallet');
    }
    
    // Initialize pool settings with default values
    this.updatePoolSettings({
      uploadPoolPercentage: 70,
      likePoolPercentage: 30,
      dailyDistribution: 0.1 // Start with a small daily distribution
    });
  }

  /**
   * Check if the pool wallet is properly configured
   */
  isConfigured(): boolean {
    return !!(this.poolAddress && this.poolPrivateKey);
  }
  
  /**
   * Get the pool wallet's public address
   */
  getPoolAddress(): string {
    return this.poolAddress;
  }
  
  /**
   * Get the current pool balance
   */
  async getPoolBalance(): Promise<number> {
    if (!this.isConfigured()) {
      throw new Error('Pool wallet not configured');
    }
    
    try {
      const accountInfo = await nanoTransactions.getAccountInfo(this.poolAddress);
      if (accountInfo && accountInfo.balance) {
        // Convert raw balance to XNO
        const balanceXNO = parseFloat(accountInfo.balance) / 1e30;
        // Update pool stats
        this.poolStats.totalPool = balanceXNO;
        return balanceXNO;
      }
      return this.poolStats.totalPool; // Return cached value if API fails
    } catch (error) {
      log(`Error getting pool balance: ${error}`, 'poolWallet');
      return this.poolStats.totalPool; // Return cached value if API fails
    }
  }
  
  /**
   * Get current pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    // Refresh balance if needed
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - this.lastUpdated.getTime()) / (1000 * 60);
    
    if (minutesSinceUpdate > 5) { // Refresh every 5 minutes
      try {
        const balance = await this.getPoolBalance();
        this.poolStats.totalPool = balance;
        this.lastUpdated = now;
      } catch (error) {
        // Continue with cached data
        log(`Using cached pool stats due to error: ${error}`, 'poolWallet');
      }
    }
    
    return this.poolStats;
  }
  
  /**
   * Update pool distribution settings
   */
  updatePoolSettings(settings: Partial<PoolStats>): PoolStats {
    this.poolStats = { ...this.poolStats, ...settings };
    return this.poolStats;
  }
  
  /**
   * Add funds to the pool from upvotes or other revenue sources
   * In a real implementation, this would be updated automatically
   * based on actual blockchain transactions
   */
  async addToPool(amount: number): Promise<boolean> {
    // This is a simplified implementation that just updates the stats
    // In a real implementation, we would verify the transaction occurred
    this.poolStats.totalPool += amount;
    this.lastUpdated = new Date();
    return true;
  }
  
  /**
   * Distribute rewards to a list of creators based on their contribution
   */
  async distributeRewards(rewards: { walletAddress: string; amount: number }[]): Promise<RewardDistribution[]> {
    if (!this.isConfigured()) {
      throw new Error('Pool wallet not configured');
    }
    
    // Verify total distribution is not more than daily limit
    const totalAmount = rewards.reduce((sum, reward) => sum + reward.amount, 0);
    if (totalAmount > this.poolStats.dailyDistribution) {
      throw new Error(`Total distribution ${totalAmount} exceeds daily limit ${this.poolStats.dailyDistribution}`);
    }
    
    // Distribute rewards
    const results: RewardDistribution[] = [];
    for (const reward of rewards) {
      try {
        const result = await nanoTransactions.createSendBlock(
          this.poolAddress, 
          this.poolPrivateKey,
          reward.walletAddress,
          reward.amount.toString()
        );
        
        if (result.success && result.hash) {
          results.push({
            walletAddress: reward.walletAddress,
            amount: reward.amount,
            success: true,
            txHash: result.hash
          });
          // Update pool balance
          this.poolStats.totalPool -= reward.amount;
        } else {
          results.push({
            walletAddress: reward.walletAddress,
            amount: reward.amount,
            success: false,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        results.push({
          walletAddress: reward.walletAddress,
          amount: reward.amount,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    this.lastUpdated = new Date();
    return results;
  }
  
  /**
   * Calculate how much can be distributed to content creators
   * based on current pool stats
   */
  getAvailableDistribution(): number {
    // Ensure we don't distribute more than 1% of pool per day
    // or the configured daily distribution, whichever is lower
    const maxSafeDistribution = this.poolStats.totalPool * 0.01;
    return Math.min(maxSafeDistribution, this.poolStats.dailyDistribution);
  }
  
  /**
   * Process a user upvote payment, splitting between creator and pool
   */
  async processUpvote(
    fromWallet: string, 
    fromPrivateKey: string,
    creatorWallet: string, 
    contentId: number,
    amount: number = 0.01 // Default 0.01 XNO per upvote
  ): Promise<{ success: boolean; creatorTx?: string; poolTx?: string; error?: string }> {
    if (!this.isConfigured()) {
      throw new Error('Pool wallet not configured');
    }
    
    try {
      // Calculate splits (80% to creator, 20% to pool)
      const creatorAmount = amount * 0.8;
      const poolAmount = amount * 0.2;
      
      // Send to creator first
      const creatorResult = await nanoTransactions.createSendBlock(
        fromWallet,
        fromPrivateKey,
        creatorWallet,
        creatorAmount.toString()
      );
      
      if (!creatorResult.success) {
        return { 
          success: false, 
          error: `Failed to send to creator: ${creatorResult.error}` 
        };
      }
      
      // Then send to pool
      const poolResult = await nanoTransactions.createSendBlock(
        fromWallet,
        fromPrivateKey,
        this.poolAddress,
        poolAmount.toString()
      );
      
      if (!poolResult.success) {
        return { 
          success: false, 
          creatorTx: creatorResult.hash,
          error: `Sent to creator but failed to send to pool: ${poolResult.error}` 
        };
      }
      
      // Update pool balance
      this.poolStats.totalPool += poolAmount;
      this.lastUpdated = new Date();
      
      return {
        success: true,
        creatorTx: creatorResult.hash,
        poolTx: poolResult.hash
      };
    } catch (error) {
      return { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during upvote processing'
      };
    }
  }
}

// Export a singleton instance
export const poolWallet = new PoolWallet();