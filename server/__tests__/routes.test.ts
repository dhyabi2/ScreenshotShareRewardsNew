import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import { Server } from 'http';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import { fileProcessor } from '../utils/fileProcessor';
import { xnoService } from '../utils/xnoService';

// Mock dependencies
vi.mock('../storage', () => ({
  storage: {
    getAllContent: vi.fn(),
    getContent: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
    getUploadCountByWallet: vi.fn(),
    addLike: vi.fn(),
    hasLiked: vi.fn(),
    createReport: vi.fn(),
    getDailyPool: vi.fn(),
  }
}));

vi.mock('../utils/fileProcessor', () => ({
  fileProcessor: {
    processFile: vi.fn(),
  }
}));

vi.mock('../utils/xnoService', () => ({
  xnoService: {
    verifyWallet: vi.fn(),
    getWalletBalance: vi.fn(),
  }
}));

vi.mock('multer', () => {
  return () => ({
    single: () => (req: any, res: any, next: any) => {
      req.file = {
        path: '/uploads/test-image.jpg',
        mimetype: 'image/jpeg',
        originalname: 'test-image.jpg'
      };
      next();
    }
  });
});

describe('API Routes', () => {
  let app: Express;
  let server: Server;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Set up a clean Express app for each test
    app = express();
    app.use(express.json());
    
    // Register our routes
    server = await registerRoutes(app);
  });

  afterEach(() => {
    server.close();
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
      const mockContent = [
        { id: 1, title: 'Test Content 1' },
        { id: 2, title: 'Test Content 2' },
      ];
      
      (storage.getAllContent as any).mockResolvedValue(mockContent);
      
      const response = await request(app).get('/api/content');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockContent);
      expect(storage.getAllContent).toHaveBeenCalled();
    });

    it('should get specific content by id', async () => {
      const mockContent = { id: 1, title: 'Test Content 1' };
      
      (storage.getContent as any).mockResolvedValue(mockContent);
      
      const response = await request(app).get('/api/content/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockContent);
      expect(storage.getContent).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent content', async () => {
      (storage.getContent as any).mockResolvedValue(undefined);
      
      const response = await request(app).get('/api/content/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(storage.getContent).toHaveBeenCalledWith(999);
    });

    it('should upload content successfully', async () => {
      // Mock wallet verification
      (xnoService.verifyWallet as any).mockResolvedValue({ valid: true });
      
      // Mock upload count check
      (storage.getUploadCountByWallet as any).mockResolvedValue(2); // Under limit
      
      // Mock file processing
      (fileProcessor.processFile as any).mockResolvedValue({
        originalUrl: '/uploads/test-image.jpg',
        blurredUrl: '/uploads/test-image-blur.jpg',
      });
      
      // Mock content creation
      const mockContent = {
        id: 1,
        title: 'Test Upload',
        type: 'image',
        originalUrl: '/uploads/test-image.jpg',
        blurredUrl: '/uploads/test-image-blur.jpg',
        price: 0.5,
        walletAddress: 'nano_test123',
      };
      (storage.createContent as any).mockResolvedValue(mockContent);
      
      const response = await request(app)
        .post('/api/content/upload')
        .field('title', 'Test Upload')
        .field('price', '0.5')
        .field('wallet', 'nano_test123')
        .attach('screenshot', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockContent);
      expect(xnoService.verifyWallet).toHaveBeenCalled();
      expect(storage.getUploadCountByWallet).toHaveBeenCalled();
      expect(fileProcessor.processFile).toHaveBeenCalled();
      expect(storage.createContent).toHaveBeenCalled();
    });

    it('should reject upload if daily limit reached', async () => {
      // Mock wallet verification
      (xnoService.verifyWallet as any).mockResolvedValue({ valid: true });
      
      // Mock upload count check - at limit (5)
      (storage.getUploadCountByWallet as any).mockResolvedValue(5);
      
      const response = await request(app)
        .post('/api/content/upload')
        .field('title', 'Test Upload')
        .field('price', '0.5')
        .field('wallet', 'nano_test123')
        .attach('screenshot', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('limit');
      expect(storage.createContent).not.toHaveBeenCalled();
    });
  });

  describe('Like API', () => {
    it('should add like to content', async () => {
      // Mock content exists
      (storage.getContent as any).mockResolvedValue({
        id: 1,
        title: 'Test Content',
        status: 'active'
      });
      
      // Mock has not liked
      (storage.hasLiked as any).mockResolvedValue(false);
      
      // Mock add like
      (storage.addLike as any).mockResolvedValue({ id: 1, contentId: 1, walletAddress: 'nano_test123' });
      
      // Mock updated content
      (storage.getContent as any).mockResolvedValueOnce({
        id: 1,
        title: 'Test Content',
        status: 'active'
      }).mockResolvedValueOnce({
        id: 1,
        title: 'Test Content',
        status: 'active',
        likeCount: 1
      });
      
      const response = await request(app)
        .post('/api/content/1/like')
        .send({ walletAddress: 'nano_test123' });
      
      expect(response.status).toBe(200);
      expect(storage.getContent).toHaveBeenCalledTimes(2);
      expect(storage.hasLiked).toHaveBeenCalledWith(1, 'nano_test123');
      expect(storage.addLike).toHaveBeenCalled();
    });

    it('should reject like if already liked', async () => {
      // Mock content exists
      (storage.getContent as any).mockResolvedValue({
        id: 1,
        title: 'Test Content',
        status: 'active'
      });
      
      // Mock has already liked
      (storage.hasLiked as any).mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/content/1/like')
        .send({ walletAddress: 'nano_test123' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already liked');
      expect(storage.addLike).not.toHaveBeenCalled();
    });
  });

  describe('Wallet API', () => {
    it('should verify a valid wallet', async () => {
      const mockWalletInfo = {
        address: 'nano_test123',
        balance: 5.5,
        valid: true
      };
      
      (xnoService.verifyWallet as any).mockResolvedValue(mockWalletInfo);
      
      const response = await request(app)
        .post('/api/wallet/verify')
        .send({ address: 'nano_test123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockWalletInfo);
      expect(xnoService.verifyWallet).toHaveBeenCalledWith('nano_test123');
    });

    it('should get wallet balance', async () => {
      (xnoService.getWalletBalance as any).mockResolvedValue(5.5);
      
      const response = await request(app)
        .post('/api/wallet/balance')
        .send({ address: 'nano_test123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ balance: 5.5 });
      expect(xnoService.getWalletBalance).toHaveBeenCalledWith('nano_test123');
    });
  });

  describe('Rewards API', () => {
    it('should get daily pool stats', async () => {
      const mockPool = {
        totalPool: 1000,
        uploadPoolPercentage: 10,
        likePoolPercentage: 90
      };
      
      (storage.getDailyPool as any).mockResolvedValue(mockPool);
      (storage.getAllContent as any).mockResolvedValue([
        { likeCount: 5 },
        { likeCount: 3 }
      ]);
      
      const response = await request(app).get('/api/rewards/pool-stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalPool', 1000);
      expect(response.body).toHaveProperty('uploadPoolPercentage', 10);
      expect(response.body).toHaveProperty('likePoolPercentage', 90);
      expect(response.body).toHaveProperty('totalUploads', 2);
      expect(response.body).toHaveProperty('totalLikes', 8);
    });
  });
});