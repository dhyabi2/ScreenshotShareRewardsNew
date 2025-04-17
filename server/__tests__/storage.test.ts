import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../storage';
import { InsertContent, InsertLike, InsertPayment, InsertReport } from '@shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  // Content operations tests
  describe('Content operations', () => {
    it('should create and retrieve content', async () => {
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_1abc123',
      };

      const content = await storage.createContent(contentData);
      expect(content).toBeDefined();
      expect(content.id).toBe(1);
      expect(content.title).toBe(contentData.title);
      expect(content.isPaid).toBe(false);

      const retrieved = await storage.getContent(content.id);
      expect(retrieved).toEqual(content);
    });

    it('should update content', async () => {
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_1abc123',
      };

      const content = await storage.createContent(contentData);
      const updated = await storage.updateContent(content.id, { title: 'Updated Title' });
      
      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      
      const retrieved = await storage.getContent(content.id);
      expect(retrieved?.title).toBe('Updated Title');
    });

    it('should get content by wallet address', async () => {
      const walletAddress = 'nano_1abc123';
      
      await storage.createContent({
        title: 'Content 1',
        type: 'image',
        originalUrl: '/test/original1.jpg',
        blurredUrl: '/test/blurred1.jpg',
        price: 0.5,
        walletAddress,
      });
      
      await storage.createContent({
        title: 'Content 2',
        type: 'image',
        originalUrl: '/test/original2.jpg',
        blurredUrl: '/test/blurred2.jpg',
        price: 0.5,
        walletAddress,
      });
      
      await storage.createContent({
        title: 'Content 3',
        type: 'image',
        originalUrl: '/test/original3.jpg',
        blurredUrl: '/test/blurred3.jpg',
        price: 0.5,
        walletAddress: 'different_wallet',
      });
      
      const walletContent = await storage.getContentByWallet(walletAddress);
      expect(walletContent.length).toBe(2);
      expect(walletContent[0].walletAddress).toBe(walletAddress);
      expect(walletContent[1].walletAddress).toBe(walletAddress);
    });
  });

  // Like operations tests
  describe('Like operations', () => {
    it('should add like and update content like count', async () => {
      const content = await storage.createContent({
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_1abc123',
      });
      
      const like: InsertLike = {
        contentId: content.id,
        walletAddress: 'nano_liker123',
      };
      
      await storage.addLike(like);
      
      const updatedContent = await storage.getContent(content.id);
      expect(updatedContent?.likeCount).toBe(1);
      
      const hasLiked = await storage.hasLiked(content.id, like.walletAddress);
      expect(hasLiked).toBe(true);
    });

    it('should remove like and update content like count', async () => {
      const content = await storage.createContent({
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_1abc123',
      });
      
      const like: InsertLike = {
        contentId: content.id,
        walletAddress: 'nano_liker123',
      };
      
      await storage.addLike(like);
      
      const updatedContent = await storage.getContent(content.id);
      expect(updatedContent?.likeCount).toBe(1);
      
      const removed = await storage.removeLike(content.id, like.walletAddress);
      expect(removed).toBe(true);
      
      const contentAfterRemove = await storage.getContent(content.id);
      expect(contentAfterRemove?.likeCount).toBe(0);
      
      const hasLiked = await storage.hasLiked(content.id, like.walletAddress);
      expect(hasLiked).toBe(false);
    });
  });

  // Payment operations tests
  describe('Payment operations', () => {
    it('should create payment records', async () => {
      const payment: InsertPayment = {
        fromWallet: 'nano_payer123',
        toWallet: 'nano_receiver123',
        amount: 1.5,
        contentId: 1,
        type: 'payment',
      };
      
      const created = await storage.createPayment(payment);
      expect(created).toBeDefined();
      expect(created.id).toBe(1);
      expect(created.fromWallet).toBe(payment.fromWallet);
      expect(created.verified).toBe(false);
      
      const retrieved = await storage.getPayment(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should mark content as paid when payment is created', async () => {
      const content = await storage.createContent({
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_receiver123',
      });
      
      const payment: InsertPayment = {
        fromWallet: 'nano_payer123',
        toWallet: 'nano_receiver123',
        amount: 0.5,
        contentId: content.id,
        type: 'payment',
      };
      
      await storage.createPayment(payment);
      
      const updatedContent = await storage.getContent(content.id);
      expect(updatedContent?.isPaid).toBe(true);
    });
  });

  // Report operations tests
  describe('Report operations', () => {
    it('should create report and mark content as flagged', async () => {
      const content = await storage.createContent({
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_1abc123',
      });
      
      const report: InsertReport = {
        contentId: content.id,
        reason: 'Inappropriate content',
        reporterWallet: 'nano_reporter123',
      };
      
      await storage.createReport(report);
      
      const updatedContent = await storage.getContent(content.id);
      expect(updatedContent?.status).toBe('flagged');
      
      const unresolvedReports = await storage.getUnresolvedReports();
      expect(unresolvedReports.length).toBe(1);
      expect(unresolvedReports[0].contentId).toBe(content.id);
    });

    it('should resolve reports and update content status', async () => {
      const content = await storage.createContent({
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test/original.jpg',
        blurredUrl: '/test/blurred.jpg',
        price: 0.5,
        walletAddress: 'nano_1abc123',
      });
      
      const report: InsertReport = {
        contentId: content.id,
        reason: 'Inappropriate content',
        reporterWallet: 'nano_reporter123',
      };
      
      const createdReport = await storage.createReport(report);
      
      await storage.resolveReport(createdReport.id, 'removed');
      
      const updatedContent = await storage.getContent(content.id);
      expect(updatedContent?.status).toBe('removed');
      
      const unresolvedReports = await storage.getUnresolvedReports();
      expect(unresolvedReports.length).toBe(0);
    });
  });

  // Daily pool operations tests
  describe('Daily pool operations', () => {
    it('should set and get daily pool', async () => {
      const pool = {
        totalPool: 2000,
        uploadPoolPercentage: 20,
        likePoolPercentage: 80,
      };
      
      const created = await storage.setDailyPool(pool);
      expect(created).toBeDefined();
      expect(created.totalPool).toBe(pool.totalPool);
      
      const retrieved = await storage.getDailyPool();
      expect(retrieved).toEqual(created);
    });

    it('should calculate estimated earnings', async () => {
      // Create content by wallet
      const walletAddress = 'nano_earner123';
      
      await storage.createContent({
        title: 'Content 1',
        type: 'image',
        originalUrl: '/test/original1.jpg',
        blurredUrl: '/test/blurred1.jpg',
        price: 0.5,
        walletAddress,
      });
      
      // Add some likes
      await storage.addLike({
        contentId: 1,
        walletAddress: 'nano_liker1',
      });
      
      await storage.addLike({
        contentId: 1,
        walletAddress: 'nano_liker2',
      });
      
      // Calculate earnings
      const earnings = await storage.getEstimatedEarnings(walletAddress);
      expect(earnings).toBeGreaterThan(0);
    });
  });
});