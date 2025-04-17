import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import { Server } from 'http';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import { InsertContent, InsertDailyPool } from '../../shared/schema';

// Setup a test environment without mocks
describe('API Routes', () => {
  let app: Express;
  let server: Server;
  
  // Create test directory for temporary files
  const testDir = path.resolve('./test-api-uploads');
  const testImagePath = path.join(testDir, 'test-api-image.jpg');

  // Setup test environment
  beforeEach(async () => {
    // Reset storage
    (storage as any).content = new Map();
    (storage as any).likes = new Map();
    (storage as any).payments = new Map();
    (storage as any).reports = new Map();
    (storage as any).contentCounter = 0;
    (storage as any).likeCounter = 0;
    (storage as any).paymentCounter = 0;
    (storage as any).reportCounter = 0;
    
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create simple test image
    const testImage = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00
    ]);
    fs.writeFileSync(testImagePath, testImage);
    
    // Set up daily pool for testing
    const poolData: InsertDailyPool = {
      totalPool: '1000',
      uploadPoolPercentage: 60,
      likePoolPercentage: 40,
    };
    await storage.setDailyPool(poolData);
    
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Register routes
    server = await registerRoutes(app);
  });

  afterEach(() => {
    // Close server
    server.close();
    
    // Cleanup test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
    // Remove test directory if empty
    try {
      if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
        fs.rmdirSync(testDir);
      }
    } catch (error) {
      console.warn('Could not remove test directory:', error);
    }
  });

  describe('Health Check', () => {
    it('should return ok status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Content API', () => {
    it('should get all content', async () => {
      // Add some content first
      const contentData1: InsertContent = {
        title: 'Test Content 1',
        type: 'image',
        originalUrl: '/uploads/test1.jpg',
        blurredUrl: '/uploads/test1-blur.jpg',
        price: '10',
        walletAddress: 'nano_test123',
      };
      
      const contentData2: InsertContent = {
        title: 'Test Content 2',
        type: 'image',
        originalUrl: '/uploads/test2.jpg',
        blurredUrl: '/uploads/test2-blur.jpg',
        price: '20',
        walletAddress: 'nano_test456',
      };
      
      await storage.createContent(contentData1);
      await storage.createContent(contentData2);
      
      // Get all content
      const response = await request(app).get('/api/content');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].title).toBe('Test Content 1');
      expect(response.body[1].title).toBe('Test Content 2');
    });

    it('should get specific content by id', async () => {
      // Add content first
      const contentData: InsertContent = {
        title: 'Test Content ID',
        type: 'image',
        originalUrl: '/uploads/test-id.jpg',
        blurredUrl: '/uploads/test-id-blur.jpg',
        price: '10',
        walletAddress: 'nano_test123',
      };
      
      const content = await storage.createContent(contentData);
      
      // Get content by ID
      const response = await request(app).get(`/api/content/${content.id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Test Content ID');
      expect(response.body.id).toBe(content.id);
    });

    it('should return 404 for non-existent content', async () => {
      // Try to get non-existent content
      const response = await request(app).get('/api/content/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Like API', () => {
    it('should add like to content', async () => {
      // First create content
      const contentData: InsertContent = {
        title: 'Likeable Content',
        type: 'image',
        originalUrl: '/uploads/like-test.jpg',
        blurredUrl: '/uploads/like-test-blur.jpg',
        price: '5',
        walletAddress: 'nano_creator',
      };
      
      const content = await storage.createContent(contentData);
      
      // Like the content
      const response = await request(app)
        .post(`/api/content/${content.id}/like`)
        .send({ walletAddress: 'nano_liker123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('likeCount', 1);
      
      // Verify like was recorded in storage
      const hasLiked = await storage.hasLiked(Number(content.id), 'nano_liker123');
      expect(hasLiked).toBe(true);
    });

    it('should reject like if already liked', async () => {
      // Create content
      const contentData: InsertContent = {
        title: 'Already Liked Content',
        type: 'image',
        originalUrl: '/uploads/already-liked.jpg',
        blurredUrl: '/uploads/already-liked-blur.jpg',
        price: '5',
        walletAddress: 'nano_creator',
      };
      
      const content = await storage.createContent(contentData);
      
      // Add a like first
      await storage.addLike({
        contentId: Number(content.id),
        walletAddress: 'nano_repeat_liker'
      });
      
      // Try to like again
      const response = await request(app)
        .post(`/api/content/${content.id}/like`)
        .send({ walletAddress: 'nano_repeat_liker' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already liked');
    });
  });

  describe('Rewards API', () => {
    it('should get daily pool stats', async () => {
      // Add content with likes to test stats
      const contentData: InsertContent = {
        title: 'Stats Content',
        type: 'image',
        originalUrl: '/uploads/stats-test.jpg',
        blurredUrl: '/uploads/stats-test-blur.jpg',
        price: '5',
        walletAddress: 'nano_creator',
      };
      
      const content = await storage.createContent(contentData);
      
      // Add likes
      await storage.addLike({
        contentId: Number(content.id),
        walletAddress: 'nano_liker1'
      });
      
      await storage.addLike({
        contentId: Number(content.id),
        walletAddress: 'nano_liker2'
      });
      
      // Get pool stats
      const response = await request(app).get('/api/rewards/pool-stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalPool', 1000);
      expect(response.body).toHaveProperty('uploadPoolPercentage', 60);
      expect(response.body).toHaveProperty('likePoolPercentage', 40);
      expect(response.body).toHaveProperty('totalUploads', 1);
      expect(response.body).toHaveProperty('totalLikes', 2);
    });
  });
});