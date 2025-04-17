import { describe, it, expect, beforeEach } from 'vitest';
import { rewardSystem } from '../utils/rewardSystem';
import { storage } from '../storage';
import { InsertContent, InsertLike, InsertDailyPool } from '../../shared/schema.js';

describe('RewardSystem', () => {
  beforeEach(async () => {
    // Reset the storage by re-initializing the maps
    (storage as any).content = new Map();
    (storage as any).likes = new Map();
    (storage as any).payments = new Map();
    (storage as any).reports = new Map();
    (storage as any).contentCounter = 0;
    (storage as any).likeCounter = 0;
    (storage as any).paymentCounter = 0;
    (storage as any).reportCounter = 0;
    
    // Set up a daily pool for testing
    const poolData: InsertDailyPool = {
      totalPool: '1000',
      uploadPoolPercentage: 60,
      likePoolPercentage: 40,
    };
    
    await storage.setDailyPool(poolData);
  });
  
  describe('calculateUploadReward', () => {
    it('should return zero if wallet has no uploads', async () => {
      const reward = await rewardSystem.calculateUploadReward('nano_nowallet');
      expect(reward).toBe(0);
    });
    
    it('should calculate upload rewards based on daily pool and upload count', async () => {
      // Add test content from different wallets
      const walletAddress = 'nano_test1234';
      
      // Content from our test wallet
      const contentData1: InsertContent = {
        title: 'Test Content 1',
        type: 'image',
        originalUrl: '/uploads/test1.jpg',
        blurredUrl: '/uploads/test1-blurred.jpg',
        price: '10',
        walletAddress,
      };
      
      const contentData2: InsertContent = {
        title: 'Test Content 2',
        type: 'video',
        originalUrl: '/uploads/test2.mp4',
        blurredUrl: '/uploads/test2-blurred.jpg',
        price: '20',
        walletAddress,
        durationSeconds: 120
      };
      
      // Content from another wallet
      const contentData3: InsertContent = {
        title: 'Other Content',
        type: 'image',
        originalUrl: '/uploads/other.jpg',
        blurredUrl: '/uploads/other-blurred.jpg',
        price: '5',
        walletAddress: 'nano_other',
      };
      
      // Add all content to storage
      await storage.createContent(contentData1);
      await storage.createContent(contentData2);
      await storage.createContent(contentData3);
      
      const reward = await rewardSystem.calculateUploadReward(walletAddress);
      
      // Our wallet has 2 out of 3 content items (66.6%)
      // The daily pool total is 1000
      // The upload pool percentage is 60%
      // So the upload pool is 600
      // Our reward should be approximately 66.6% of 600 = 400
      expect(reward).toBeGreaterThan(0);
      expect(reward).toBeCloseTo(400, -1); // Allow some wiggle room for precise calculation differences
    });
  });
  
  describe('calculateLikeReward', () => {
    it('should return zero if content has no likes', async () => {
      // Create content with no likes
      const walletAddress = 'nano_test1234';
      const contentData: InsertContent = {
        title: 'Test Content 1',
        type: 'image',
        originalUrl: '/uploads/test1.jpg',
        blurredUrl: '/uploads/test1-blurred.jpg',
        price: '10',
        walletAddress,
      };
      
      await storage.createContent(contentData);
      
      const reward = await rewardSystem.calculateLikeReward(walletAddress);
      expect(reward).toBe(0);
    });
    
    it('should calculate like-based rewards based on content likes', async () => {
      // Create content with likes from different wallets
      const creatorWallet = 'nano_creator';
      const liker1 = 'nano_liker1';
      const liker2 = 'nano_liker2';
      
      // First create content
      const contentData: InsertContent = {
        title: 'Test Content 1',
        type: 'image',
        originalUrl: '/uploads/test1.jpg',
        blurredUrl: '/uploads/test1-blurred.jpg',
        price: '10',
        walletAddress: creatorWallet,
      };
      
      const content = await storage.createContent(contentData);
      const contentId = Number(content.id);
      
      // Add likes from different wallets
      const like1: InsertLike = {
        contentId,
        walletAddress: liker1,
      };
      
      const like2: InsertLike = {
        contentId,
        walletAddress: liker2,
      };
      
      await storage.addLike(like1);
      await storage.addLike(like2);
      
      // Calculate the reward
      const reward = await rewardSystem.calculateLikeReward(creatorWallet);
      
      // Content has all the likes in the system
      // Daily pool total is 1000
      // Like pool percentage is 40%
      // So like pool is 400
      // This content has 100% of likes, but capped at 5% per content
      // So reward should be 400 * 0.05 = 20
      expect(reward).toBeGreaterThan(0);
      expect(reward).toBeLessThanOrEqual(400 * 0.05); // Max 5% of like pool per content
    });
  });
  
  describe('calculateTotalRewards', () => {
    it('should sum upload and like rewards', async () => {
      // Set up a scenario with both uploads and likes
      const walletAddress = 'nano_test1234';
      
      // Add content
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: '10',
        walletAddress,
      };
      
      const content = await storage.createContent(contentData);
      
      // Add a like to the content
      const like: InsertLike = {
        contentId: Number(content.id),
        walletAddress: 'nano_liker456',
      };
      
      await storage.addLike(like);
      
      // Calculate total rewards
      const uploadReward = await rewardSystem.calculateUploadReward(walletAddress);
      const likeReward = await rewardSystem.calculateLikeReward(walletAddress);
      const totalReward = await rewardSystem.calculateTotalRewards(walletAddress);
      
      // Total should be sum of individual rewards
      expect(totalReward).toBe(uploadReward + likeReward);
    });
  });
});