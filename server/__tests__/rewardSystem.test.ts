import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rewardSystem } from '../utils/rewardSystem';
import { storage } from '../storage';
import { Content, Like, DailyPool } from '@shared/schema';

// Mock the storage module
vi.mock('../storage', () => ({
  storage: {
    getDailyPool: vi.fn(),
    getAllContent: vi.fn(),
    getContentByWallet: vi.fn(),
    getUploadCountByWallet: vi.fn(),
  }
}));

describe('RewardSystem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('calculateUploadReward', () => {
    it('should return 0 if daily pool is not set', async () => {
      // Mock the getDailyPool to return undefined
      (storage.getDailyPool as any).mockResolvedValue(undefined);
      
      const reward = await rewardSystem.calculateUploadReward('test_wallet');
      
      expect(reward).toBe(0);
      expect(storage.getDailyPool).toHaveBeenCalled();
    });

    it('should return 0 if no uploads today', async () => {
      // Mock daily pool
      (storage.getDailyPool as any).mockResolvedValue({
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      });
      
      // Mock empty content list
      (storage.getAllContent as any).mockResolvedValue([]);
      
      const reward = await rewardSystem.calculateUploadReward('test_wallet');
      
      expect(reward).toBe(0);
      expect(storage.getDailyPool).toHaveBeenCalled();
      expect(storage.getAllContent).toHaveBeenCalled();
    });

    it('should calculate upload reward based on user\'s uploads and total uploads', async () => {
      const today = new Date();
      
      // Mock daily pool
      (storage.getDailyPool as any).mockResolvedValue({
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      });
      
      // Mock content with uploads today
      (storage.getAllContent as any).mockResolvedValue([
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
      ]);
      
      // Mock user uploads (2 out of 4 total)
      (storage.getUploadCountByWallet as any).mockResolvedValue(2);
      
      const reward = await rewardSystem.calculateUploadReward('test_wallet');
      
      // Expected reward: (1000 * 0.1) * (2/4) = 50
      expect(reward).toBe(50);
      expect(storage.getDailyPool).toHaveBeenCalled();
      expect(storage.getAllContent).toHaveBeenCalled();
      expect(storage.getUploadCountByWallet).toHaveBeenCalled();
    });

    it('should cap user uploads at MAX_UPLOADS_PER_WALLET', async () => {
      const today = new Date();
      
      // Mock daily pool
      (storage.getDailyPool as any).mockResolvedValue({
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      });
      
      // Mock content with uploads today
      (storage.getAllContent as any).mockResolvedValue([
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
      ]);
      
      // Mock user uploads (6 uploads, but should be capped at 5)
      (storage.getUploadCountByWallet as any).mockResolvedValue(6);
      
      const reward = await rewardSystem.calculateUploadReward('test_wallet');
      
      // Expected reward: (1000 * 0.1) * (5/6) = 83.33...
      expect(reward).toBeCloseTo(83.33, 1);
    });
  });

  describe('calculateLikeReward', () => {
    it('should return 0 if daily pool is not set', async () => {
      // Mock the getDailyPool to return undefined
      (storage.getDailyPool as any).mockResolvedValue(undefined);
      
      const reward = await rewardSystem.calculateLikeReward('test_wallet');
      
      expect(reward).toBe(0);
      expect(storage.getDailyPool).toHaveBeenCalled();
    });

    it('should return 0 if no likes across all content', async () => {
      // Mock daily pool
      (storage.getDailyPool as any).mockResolvedValue({
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      });
      
      // Mock content with no likes
      (storage.getAllContent as any).mockResolvedValue([
        { likeCount: 0 },
        { likeCount: 0 },
      ]);
      
      const reward = await rewardSystem.calculateLikeReward('test_wallet');
      
      expect(reward).toBe(0);
      expect(storage.getDailyPool).toHaveBeenCalled();
      expect(storage.getAllContent).toHaveBeenCalled();
    });

    it('should calculate like reward based on content likes', async () => {
      // Mock daily pool
      (storage.getDailyPool as any).mockResolvedValue({
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      });
      
      // Mock total content with likes
      (storage.getAllContent as any).mockResolvedValue([
        { likeCount: 5 },
        { likeCount: 15 },
      ]);
      
      // Mock user's content with likes
      (storage.getContentByWallet as any).mockResolvedValue([
        { likeCount: 5 },
      ]);
      
      const reward = await rewardSystem.calculateLikeReward('test_wallet');
      
      // Expected reward: (1000 * 0.9) * (5/20) = 225
      // But capped at 5% of like pool: 1000 * 0.9 * 0.05 = 45
      expect(reward).toBe(45);
      expect(storage.getDailyPool).toHaveBeenCalled();
      expect(storage.getAllContent).toHaveBeenCalled();
      expect(storage.getContentByWallet).toHaveBeenCalled();
    });

    it('should cap rewards for viral content', async () => {
      // Mock daily pool
      (storage.getDailyPool as any).mockResolvedValue({
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      });
      
      // Mock total content with likes (100 total likes)
      (storage.getAllContent as any).mockResolvedValue([
        { likeCount: 80 },
        { likeCount: 20 },
      ]);
      
      // Mock user's content with likes (80 likes, very viral)
      (storage.getContentByWallet as any).mockResolvedValue([
        { likeCount: 80 },
      ]);
      
      const reward = await rewardSystem.calculateLikeReward('test_wallet');
      
      // Uncapped would be: (1000 * 0.9) * (80/100) = 720
      // But capped at 5% of like pool: 1000 * 0.9 * 0.05 = 45
      expect(reward).toBe(45);
    });
  });

  describe('calculateTotalRewards', () => {
    it('should sum upload and like rewards', async () => {
      // Mock the individual calculation methods
      vi.spyOn(rewardSystem, 'calculateUploadReward').mockResolvedValue(50);
      vi.spyOn(rewardSystem, 'calculateLikeReward').mockResolvedValue(45);
      
      const totalReward = await rewardSystem.calculateTotalRewards('test_wallet');
      
      expect(totalReward).toBe(95);
      expect(rewardSystem.calculateUploadReward).toHaveBeenCalledWith('test_wallet');
      expect(rewardSystem.calculateLikeReward).toHaveBeenCalledWith('test_wallet');
    });
  });
});