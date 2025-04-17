import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../storage';
import { Content, InsertContent, InsertLike, InsertPayment, InsertReport } from '../../shared/schema.js';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('Content Operations', () => {
    it('should create a new content item', async () => {
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_test1234',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };

      const content = await storage.createContent(contentData);
      expect(content).toBeDefined();
      expect(content.id).toBeDefined();
      expect(content.title).toBe(contentData.title);
      expect(content.type).toBe(contentData.type);
      expect(content.walletAddress).toBe(contentData.walletAddress);
    });

    it('should retrieve all content', async () => {
      // Create some test content
      const contentData1: InsertContent = {
        title: 'Test Content 1',
        type: 'image',
        originalUrl: '/uploads/test1.jpg',
        blurredUrl: '/uploads/test1-blurred.jpg',
        price: 10,
        walletAddress: 'nano_test1234',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };

      const contentData2: InsertContent = {
        title: 'Test Content 2',
        type: 'video',
        originalUrl: '/uploads/test2.mp4',
        blurredUrl: '/uploads/test2-blurred.jpg',
        price: 20,
        walletAddress: 'nano_test5678',
        likeCount: 0,
        status: 'active',
        isPaid: false,
        durationSeconds: 120
      };

      await storage.createContent(contentData1);
      await storage.createContent(contentData2);

      const allContent = await storage.getAllContent();
      expect(allContent).toHaveLength(2);
      expect(allContent[0].title).toBe(contentData1.title);
      expect(allContent[1].title).toBe(contentData2.title);
    });

    it('should get content by ID', async () => {
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_test1234',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };

      const content = await storage.createContent(contentData);
      const retrievedContent = await storage.getContent(Number(content.id));
      
      expect(retrievedContent).toBeDefined();
      expect(retrievedContent?.id).toBe(content.id);
      expect(retrievedContent?.title).toBe(content.title);
    });

    it('should update content', async () => {
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_test1234',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };

      const content = await storage.createContent(contentData);
      const updatedContent = await storage.updateContent(Number(content.id), { title: 'Updated Title', price: 15 });
      
      expect(updatedContent).toBeDefined();
      expect(updatedContent?.title).toBe('Updated Title');
      expect(updatedContent?.price).toBe(15);
      expect(updatedContent?.originalUrl).toBe(content.originalUrl);
    });

    it('should delete content', async () => {
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_test1234',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };

      const content = await storage.createContent(contentData);
      const deleted = await storage.deleteContent(Number(content.id));
      
      expect(deleted).toBe(true);
      
      const retrievedContent = await storage.getContent(Number(content.id));
      expect(retrievedContent).toBeUndefined();
    });

    it('should get content by wallet address', async () => {
      const walletAddress = 'nano_test1234';
      
      const contentData1: InsertContent = {
        title: 'Test Content 1',
        type: 'image',
        originalUrl: '/uploads/test1.jpg',
        blurredUrl: '/uploads/test1-blurred.jpg',
        price: 10,
        walletAddress,
        likeCount: 0,
        status: 'active',
        isPaid: false
      };

      const contentData2: InsertContent = {
        title: 'Test Content 2',
        type: 'video',
        originalUrl: '/uploads/test2.mp4',
        blurredUrl: '/uploads/test2-blurred.jpg',
        price: 20,
        walletAddress,
        likeCount: 0,
        status: 'active',
        isPaid: false,
        durationSeconds: 120
      };

      await storage.createContent(contentData1);
      await storage.createContent(contentData2);

      const walletContent = await storage.getContentByWallet(walletAddress);
      expect(walletContent).toHaveLength(2);
      expect(walletContent[0].walletAddress).toBe(walletAddress);
      expect(walletContent[1].walletAddress).toBe(walletAddress);
    });
  });

  describe('Like Operations', () => {
    it('should add a like to content', async () => {
      // First create content
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_creator123',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };
      
      const content = await storage.createContent(contentData);
      
      // Now add a like
      const like: InsertLike = {
        contentId: Number(content.id),
        walletAddress: 'nano_liker456',
        createdAt: new Date()
      };
      
      const addedLike = await storage.addLike(like);
      
      expect(addedLike).toBeDefined();
      expect(addedLike.contentId).toBe(like.contentId);
      expect(addedLike.walletAddress).toBe(like.walletAddress);
      
      // Check if content like count was updated
      const updatedContent = await storage.getContent(Number(content.id));
      expect(updatedContent?.likeCount).toBe(1);
    });

    it('should check if a wallet has liked content', async () => {
      // Create content
      const contentData: InsertContent = {
        title: 'Test Content',
        type: 'image',
        originalUrl: '/uploads/test.jpg',
        blurredUrl: '/uploads/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_creator123',
        likeCount: 0,
        status: 'active',
        isPaid: false
      };
      
      const content = await storage.createContent(contentData);
      const contentId = Number(content.id);
      const likerWallet = 'nano_liker456';
      
      // Initially should not have liked
      const hasLikedBefore = await storage.hasLiked(contentId, likerWallet);
      expect(hasLikedBefore).toBe(false);
      
      // Add a like
      const like: InsertLike = {
        contentId,
        walletAddress: likerWallet,
        createdAt: new Date()
      };
      
      await storage.addLike(like);
      
      // Now should have liked
      const hasLikedAfter = await storage.hasLiked(contentId, likerWallet);
      expect(hasLikedAfter).toBe(true);
    });
  });

  describe('Payment Operations', () => {
    it('should create a payment record', async () => {
      const payment: InsertPayment = {
        fromWallet: 'nano_sender123',
        toWallet: 'nano_receiver456',
        amount: 10,
        contentId: 1,
        createdAt: new Date(),
        status: 'completed',
        confirmed: true
      };
      
      const createdPayment = await storage.createPayment(payment);
      
      expect(createdPayment).toBeDefined();
      expect(createdPayment.fromWallet).toBe(payment.fromWallet);
      expect(createdPayment.toWallet).toBe(payment.toWallet);
      expect(createdPayment.amount).toBe(payment.amount);
      expect(createdPayment.confirmed).toBe(payment.confirmed);
    });

    it('should check if a payment exists', async () => {
      const fromWallet = 'nano_sender123';
      const toWallet = 'nano_receiver456';
      const amount = 10;
      const contentId = 1;
      
      // Initially no payment should exist
      const paymentExistsBefore = await storage.checkPayment(fromWallet, toWallet, amount, contentId);
      expect(paymentExistsBefore).toBe(false);
      
      // Create a payment
      const payment: InsertPayment = {
        fromWallet,
        toWallet,
        amount,
        contentId,
        createdAt: new Date(),
        status: 'completed',
        confirmed: true
      };
      
      await storage.createPayment(payment);
      
      // Now payment should exist
      const paymentExistsAfter = await storage.checkPayment(fromWallet, toWallet, amount, contentId);
      expect(paymentExistsAfter).toBe(true);
    });
  });

  describe('Report Operations', () => {
    it('should create a report', async () => {
      const report: InsertReport = {
        contentId: 1,
        reason: 'inappropriate content',
        reporterWallet: 'nano_reporter123',
        status: 'pending',
        createdAt: new Date()
      };
      
      const createdReport = await storage.createReport(report);
      
      expect(createdReport).toBeDefined();
      expect(createdReport.contentId).toBe(report.contentId);
      expect(createdReport.reason).toBe(report.reason);
      expect(createdReport.status).toBe('pending');
    });

    it('should get unresolved reports', async () => {
      // Create some test reports
      const report1: InsertReport = {
        contentId: 1,
        reason: 'inappropriate content',
        reporterWallet: 'nano_reporter123',
        status: 'pending',
        createdAt: new Date()
      };
      
      const report2: InsertReport = {
        contentId: 2,
        reason: 'copyright violation',
        reporterWallet: 'nano_reporter456',
        status: 'pending',
        createdAt: new Date()
      };
      
      const resolvedReport: InsertReport = {
        contentId: 3,
        reason: 'spam',
        reporterWallet: 'nano_reporter789',
        status: 'resolved',
        createdAt: new Date()
      };
      
      await storage.createReport(report1);
      await storage.createReport(report2);
      await storage.createReport(resolvedReport);
      
      const unresolvedReports = await storage.getUnresolvedReports();
      
      expect(unresolvedReports.length).toBe(2);
      expect(unresolvedReports.some(r => r.contentId === report1.contentId)).toBe(true);
      expect(unresolvedReports.some(r => r.contentId === report2.contentId)).toBe(true);
      expect(unresolvedReports.every(r => r.status === 'pending')).toBe(true);
    });

    it('should resolve a report', async () => {
      const report: InsertReport = {
        contentId: 1,
        reason: 'inappropriate content',
        reporterWallet: 'nano_reporter123',
        status: 'pending',
        createdAt: new Date()
      };
      
      const createdReport = await storage.createReport(report);
      const reportId = Number(createdReport.id);
      
      const resolvedReport = await storage.resolveReport(reportId, 'resolved');
      
      expect(resolvedReport).toBeDefined();
      expect(resolvedReport?.id).toBe(createdReport.id);
      expect(resolvedReport?.status).toBe('resolved');
    });
  });

  describe('Daily Pool Operations', () => {
    it('should set and get daily pool', async () => {
      const poolData = {
        totalPool: 1000,
        uploadPoolPercentage: 40,
        likePoolPercentage: 60,
        date: new Date()
      };
      
      const dailyPool = await storage.setDailyPool(poolData);
      
      expect(dailyPool).toBeDefined();
      expect(dailyPool.totalPool).toBe(poolData.totalPool);
      expect(dailyPool.uploadPoolPercentage).toBe(poolData.uploadPoolPercentage);
      expect(dailyPool.likePoolPercentage).toBe(poolData.likePoolPercentage);
      
      const retrievedPool = await storage.getDailyPool();
      expect(retrievedPool).toBeDefined();
      expect(retrievedPool?.totalPool).toBe(poolData.totalPool);
    });
  });
});