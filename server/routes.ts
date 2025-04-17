import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileProcessor } from "./utils/fileProcessor";
import { xnoService } from "./utils/xnoService";
import { rewardSystem } from "./utils/rewardSystem";

const DAILY_UPLOAD_LIMIT = 5; // Maximum uploads per wallet per day
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// Create directories if they don't exist
[UPLOAD_DIR, PUBLIC_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Content Routes
  
  // Get all content
  app.get('/api/content', async (req, res) => {
    try {
      const contents = await storage.getAllContent();
      res.json(contents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get specific content
  app.get('/api/content/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const content = await storage.getContent(id);
      
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload content
  app.post('/api/content/upload', upload.single('screenshot'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { title, price, wallet } = req.body;
      
      if (!title || !wallet) {
        return res.status(400).json({ error: 'Title and wallet address are required' });
      }
      
      // Validate wallet
      const walletInfo = await xnoService.verifyWallet(wallet);
      if (!walletInfo.valid) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }
      
      // Check daily upload limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const uploadCount = await storage.getUploadCountByWallet(wallet, today);
      
      if (uploadCount >= DAILY_UPLOAD_LIMIT) {
        return res.status(400).json({ 
          error: `Daily upload limit (${DAILY_UPLOAD_LIMIT}) reached for this wallet` 
        });
      }
      
      // Process file (generate blur, check video length)
      const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
      const processedFile = await fileProcessor.processFile(
        req.file.path, 
        fileType, 
        path.join('uploads', path.basename(req.file.path))
      );
      
      if (processedFile.error) {
        return res.status(400).json({ error: processedFile.error });
      }
      
      // Save content to storage
      const newContent = await storage.createContent({
        title,
        type: fileType,
        originalUrl: processedFile.originalUrl,
        blurredUrl: processedFile.blurredUrl,
        price: parseFloat(price) || 0,
        walletAddress: wallet,
        durationSeconds: processedFile.durationSeconds,
      });
      
      res.json(newContent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Like content
  app.post('/api/content/:id/like', async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      // Check if content exists
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      // Check if content is flagged
      if (content.status !== 'active') {
        return res.status(400).json({ error: 'Cannot like inactive content' });
      }
      
      // Check if wallet has already liked this content
      const hasLiked = await storage.hasLiked(contentId, walletAddress);
      if (hasLiked) {
        return res.status(400).json({ error: 'You have already liked this content' });
      }
      
      // Add like
      await storage.addLike({
        contentId,
        walletAddress
      });
      
      // Get updated content
      const updatedContent = await storage.getContent(contentId);
      res.json(updatedContent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Report content
  app.post('/api/content/:id/report', async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const { reason, reporterWallet } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }
      
      // Check if content exists
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      // Create report
      await storage.createReport({
        contentId,
        reason,
        reporterWallet: reporterWallet || null
      });
      
      res.json({ success: true, message: 'Content reported successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Wallet Routes
  
  // Verify wallet
  app.post('/api/wallet/verify', async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const walletInfo = await xnoService.verifyWallet(address);
      res.json(walletInfo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get wallet balance
  app.post('/api/wallet/balance', async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const balance = await xnoService.getWalletBalance(address);
      res.json({ balance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Payment Routes
  
  // Check payment
  app.post('/api/payment/check', async (req, res) => {
    try {
      const { from, to, amount, contentId } = req.body;
      
      if (!from || !to || amount === undefined) {
        return res.status(400).json({ error: 'From, to, and amount are required' });
      }
      
      // First check if we already have this payment recorded in our database
      const locallyRecorded = await storage.checkPayment(from, to, parseFloat(amount), contentId);
      
      if (locallyRecorded) {
        // Payment exists in our records
        return res.json({ paid: true, method: 'database' });
      }
      
      // If not in our database, check the blockchain
      const amountFloat = parseFloat(amount);
      const blockchainVerified = await xnoService.checkPayment(from, to, amountFloat);
      
      if (blockchainVerified) {
        // Payment verified on blockchain, record it in our database
        await storage.createPayment({
          fromWallet: from,
          toWallet: to,
          amount: amountFloat,
          contentId: contentId || null,
          type: contentId ? 'payment' : 'tip'
        });
        
        return res.json({ paid: true, method: 'blockchain' });
      }
      
      // Payment not found in our database or on blockchain
      res.json({ paid: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Rewards Routes
  
  // Get daily pool stats
  app.get('/api/rewards/pool-stats', async (req, res) => {
    try {
      const dailyPool = await storage.getDailyPool();
      
      if (!dailyPool) {
        return res.status(404).json({ error: 'Daily pool not set' });
      }
      
      // Calculate additional info
      const totalPool = parseFloat(dailyPool.totalPool.toString());
      const uploadPoolPercentage = dailyPool.uploadPoolPercentage;
      const likePoolPercentage = dailyPool.likePoolPercentage;
      
      const uploadPool = totalPool * (uploadPoolPercentage / 100);
      const likePool = totalPool * (likePoolPercentage / 100);
      
      const totalContents = (await storage.getAllContent()).length;
      const totalLikes = (await storage.getAllContent()).reduce((sum, content) => sum + content.likeCount, 0);
      
      res.json({
        totalPool,
        uploadPoolPercentage,
        likePoolPercentage,
        uploadPool,
        likePool,
        totalUploads: totalContents,
        totalLikes
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get estimated earnings for a wallet
  app.post('/api/rewards/estimated-earnings', async (req, res) => {
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
  
  // Administration Routes
  
  // Get all reports
  app.get('/api/admin/reports', async (req, res) => {
    try {
      const reports = await storage.getReports();
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Resolve report
  app.post('/api/admin/reports/:id/resolve', async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !['active', 'removed'].includes(status)) {
        return res.status(400).json({ error: 'Valid status (active/removed) is required' });
      }
      
      const report = await storage.resolveReport(reportId, status);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

import express from "express";
