import { storage } from '../storage';

class RewardSystem {
  private readonly MAX_UPLOADS_PER_WALLET = 5; // Maximum uploads per wallet per day
  private readonly MAX_REWARD_PERCENTAGE = 5; // Maximum percentage of like pool per content (5%)
  
  /**
   * Calculate the upload reward for a specific wallet address
   */
  async calculateUploadReward(walletAddress: string): Promise<number> {
    // Get daily pool stats
    const pool = await storage.getDailyPool();
    if (!pool) return 0;
    
    const totalPoolAmount = parseFloat(pool.totalPool.toString());
    const uploadPoolPercentage = pool.uploadPoolPercentage / 100;
    const uploadPoolAmount = totalPoolAmount * uploadPoolPercentage;
    
    // Get all eligible uploads for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count total uploads from all users today
    const allContent = await storage.getAllContent();
    const todayUploads = allContent.filter(
      content => new Date(content.createdAt) >= today
    );
    const totalUploadsToday = todayUploads.length;
    
    if (totalUploadsToday === 0) return 0;
    
    // Count user's uploads today (capped at MAX_UPLOADS_PER_WALLET)
    const userUploadCount = await storage.getUploadCountByWallet(walletAddress, today);
    const eligibleUploads = Math.min(userUploadCount, this.MAX_UPLOADS_PER_WALLET);
    
    // Calculate reward
    const userUploadReward = (eligibleUploads / totalUploadsToday) * uploadPoolAmount;
    
    return userUploadReward;
  }
  
  /**
   * Calculate the like-based reward for a specific wallet address
   */
  async calculateLikeReward(walletAddress: string): Promise<number> {
    // Get daily pool stats
    const pool = await storage.getDailyPool();
    if (!pool) return 0;
    
    const totalPoolAmount = parseFloat(pool.totalPool.toString());
    const likePoolPercentage = pool.likePoolPercentage / 100;
    const likePoolAmount = totalPoolAmount * likePoolPercentage;
    
    // Get total likes across all content
    const allContent = await storage.getAllContent();
    const totalLikes = allContent.reduce((sum, content) => sum + content.likeCount, 0);
    
    if (totalLikes === 0) return 0;
    
    // Get user's content
    const userContent = await storage.getContentByWallet(walletAddress);
    
    // Calculate maximum reward per content (5% of like pool)
    const maxRewardPerContent = likePoolAmount * (this.MAX_REWARD_PERCENTAGE / 100);
    
    // Calculate reward based on each content's likes, with per-content cap
    let totalLikeReward = 0;
    
    for (const content of userContent) {
      if (content.likeCount === 0) continue;
      
      const contentLikeShare = content.likeCount / totalLikes;
      const contentReward = contentLikeShare * likePoolAmount;
      
      // Apply cap to prevent one viral content from taking too much of the pool
      const cappedReward = Math.min(contentReward, maxRewardPerContent);
      totalLikeReward += cappedReward;
    }
    
    return totalLikeReward;
  }
  
  /**
   * Calculate total estimated rewards for a wallet
   */
  async calculateTotalRewards(walletAddress: string): Promise<number> {
    const uploadReward = await this.calculateUploadReward(walletAddress);
    const likeReward = await this.calculateLikeReward(walletAddress);
    
    return uploadReward + likeReward;
  }
  
  /**
   * Distribute rewards for the day
   * This would be called by a scheduled job in a production environment
   */
  async distributeRewards(): Promise<void> {
    // In a real implementation, this would:
    // 1. Get all users with content/likes for the day
    // 2. Calculate their rewards
    // 3. Send XNO transactions to their wallets
    // 4. Mark the daily pool as distributed
    
    try {
      // Get current daily pool
      const pool = await storage.getDailyPool();
      if (!pool) return;
      
      // Get all wallets that would receive rewards
      const allContent = await storage.getAllContent();
      const walletAddresses = new Set<string>();
      
      allContent.forEach(content => {
        walletAddresses.add(content.walletAddress);
      });
      
      console.log(`Distributing rewards to ${walletAddresses.size} wallets`);
      
      // For each wallet, calculate and distribute rewards
      for (const wallet of walletAddresses) {
        const totalReward = await this.calculateTotalRewards(wallet);
        
        if (totalReward > 0) {
          // In a real implementation, send XNO to the wallet
          console.log(`Sending ${totalReward.toFixed(6)} XNO to ${wallet}`);
        }
      }
      
      // Mark pool as distributed
      // In a real impl, we'd create a new pool for the next day
      console.log('Daily rewards distribution completed');
    } catch (error) {
      console.error('Error distributing rewards:', error);
    }
  }
}

export const rewardSystem = new RewardSystem();
