import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileProcessor } from "./utils/fileProcessor";
import { xnoService } from "./utils/xnoService";
import { walletService } from "./utils/walletService";
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
  
  // Get content by wallet address - must be before the :id route to avoid conflict
  app.get('/api/content/wallet/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const content = await storage.getContentByWallet(walletAddress);
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get specific content by ID
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
  
  // Enhanced wallet endpoints with walletService
  app.post('/api/wallet/info', async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const walletInfo = await walletService.getWalletInfo(address);
      
      // Log wallet info for debugging
      console.log(`Retrieved wallet info for ${address}: Balance=${walletInfo.balance}, Pending=${walletInfo.pending ? walletInfo.pending.blocks.length : 0} blocks`);
      
      res.json(walletInfo);
    } catch (error: any) {
      console.error('Error in wallet info route:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/wallet/transactions', async (req, res) => {
    try {
      const { address, count = 10 } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const transactions = await walletService.getTransactionHistory(address, count);
      res.json({ transactions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/wallet/receive', async (req, res) => {
    try {
      const { address, privateKey, debug } = req.body;
      
      if (!address || !privateKey) {
        return res.status(400).json({ error: 'Wallet address and private key are required' });
      }
      
      console.log(`Attempting to receive pending funds for wallet: ${address}`);
      
      // First get wallet info to see if there's anything to receive
      const walletInfo = await walletService.getWalletInfo(address);
      console.log(`Wallet has ${walletInfo.pending?.blocks?.length || 0} pending blocks totaling ${walletInfo.pending?.totalAmount || 0} XNO`);
      
      if (!walletInfo.pending || walletInfo.pending.blocks.length === 0) {
        return res.json({ received: false, count: 0, totalAmount: 0, message: 'No pending transactions to receive' });
      }
      
      try {
        // Check if account exists or is new (this affects how we receive funds)
        const accountInfo = await walletService.getAccountInfo(address);
        const isNewAccount = !accountInfo || accountInfo.error === 'Account not found' || !accountInfo.frontier;
        
        console.log(`Account status: ${isNewAccount ? 'NEW (needs open block)' : 'EXISTING'}`);
        
        // Use the advanced method with options for better handling of new accounts
        // This method properly handles the difference between opening blocks and receive blocks
        const result = await walletService.receivePendingWithOptions(
          address, 
          privateKey, 
          {
            // Use lower work threshold for opening blocks if needed
            workThreshold: isNewAccount ? 'ff00000000000000' : 'ffff000000000000',
            maxRetries: 3
          }
        );
        
        console.log(`Receive result: ${JSON.stringify(result)}`);
        
        if (debug) {
          // Get additional debug information about the wallet
          let debugInfo;
          try {
            const accountInfoResponse = await fetch(walletService.apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': walletService.rpcKey
              },
              body: JSON.stringify({
                action: 'account_info',
                account: address,
                representative: true,
                pending: true
              })
            });
            
            debugInfo = await accountInfoResponse.json();
          } catch (debugError) {
            debugInfo = { error: "Could not fetch debug info" };
          }
          
          // Return additional debug information
          res.json({
            received: result.received,
            count: result.count,
            totalAmount: result.totalAmount,
            processedBlocks: result.processedBlocks,
            debug: {
              walletAddress: address,
              privateKeyProvided: !!privateKey,
              privateKeyFirstChars: privateKey ? privateKey.substring(0, 6) + '...' : 'none',
              isNewAccount,
              accountInfo: debugInfo,
              pendingBlocks: walletInfo.pending?.blocks || []
            }
          });
        } else {
          res.json(result);
        }
      } catch (processError) {
        console.error('Error processing pending blocks:', processError);
        
        if (debug) {
          // Return error details in debug mode
          res.status(500).json({
            received: false,
            count: 0,
            totalAmount: 0,
            error: processError.message,
            debug: {
              errorDetails: processError.toString(),
              walletAddress: address,
              privateKeyProvided: !!privateKey,
              privateKeyFirstChars: privateKey ? privateKey.substring(0, 6) + '...' : 'none',
              pendingBlocks: walletInfo.pending?.blocks || []
            }
          });
        } else {
          res.status(500).json({ 
            received: false, 
            count: 0, 
            totalAmount: 0,
            error: processError.message 
          });
        }
      }
    } catch (error: any) {
      console.error('Error in receive pending route:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Advanced receive endpoint with additional options
  app.post('/api/wallet/receive-with-options', async (req, res) => {
    try {
      const { address, privateKey, workThreshold, maxRetries, debug } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      if (!walletService.isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      
      console.log(`Attempting to receive with custom options for wallet: ${address}`);
      
      // First get wallet info to see if there's anything to receive
      const walletInfo = await walletService.getWalletInfo(address);
      console.log(`Wallet has ${walletInfo.pending?.blocks?.length || 0} pending blocks totaling ${walletInfo.pending?.totalAmount || 0} XNO`);
      
      if (!walletInfo.pending?.blocks?.length) {
        return res.json({ received: false, count: 0, totalAmount: 0 });
      }
      
      if (!privateKey) {
        return res.status(400).json({ error: 'Private key is required to receive funds' });
      }
      
      try {
        // Check if account is new (never received funds before)
        const accountInfo = await walletService.getAccountInfo(address);
        const isNewAccount = accountInfo?.error === 'Account not found';
        console.log(`Account status: ${isNewAccount ? 'NEW - opening block needed' : 'EXISTING - receive block needed'}`);
        
        // For new accounts, we need to use an even lower threshold initially
        const adaptedWorkThreshold = isNewAccount 
          ? (workThreshold || '0000000000000000') // Use zero threshold for new accounts by default
          : (workThreshold || 'fffffff000000000'); // Use a safe threshold for existing accounts
          
        // Process the pending blocks with custom options
        const result = await walletService.receivePendingWithOptions(
          address, 
          privateKey, 
          {
            workThreshold: adaptedWorkThreshold,
            maxRetries: maxRetries || 5, // Use more retries by default
            isNewAccount: isNewAccount
          }
        );
        
        console.log(`Receive with options result: ${JSON.stringify(result)}`);
        
        if (debug) {
          // Get additional debug information about the wallet
          let debugInfo;
          try {
            const accountInfoResponse = await fetch(walletService.apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': walletService.rpcKey
              },
              body: JSON.stringify({
                action: 'account_info',
                account: address,
                representative: true,
                pending: true
              })
            });
            
            debugInfo = await accountInfoResponse.json();
          } catch (debugError) {
            debugInfo = { error: "Could not fetch debug info" };
          }
          
          // Return additional debug information
          res.json({
            ...result,
            debug: {
              walletAddress: address,
              privateKeyProvided: !!privateKey,
              privateKeyFirstChars: privateKey ? privateKey.substring(0, 6) + '...' : 'none',
              accountInfo: debugInfo,
              pendingBlocks: walletInfo.pending?.blocks || [],
              customSettings: {
                workThreshold: adaptedWorkThreshold,
                maxRetries: maxRetries || 5,
                isNewAccount: isNewAccount
              }
            }
          });
        } else {
          res.json(result);
        }
      } catch (processError) {
        console.error('Error processing pending blocks with custom options:', processError);
        
        if (debug) {
          // Return error details in debug mode
          res.status(500).json({
            received: false,
            count: 0,
            totalAmount: 0,
            error: processError.message,
            debug: {
              errorDetails: processError.toString(),
              walletAddress: address,
              privateKeyProvided: !!privateKey,
              privateKeyFirstChars: privateKey ? privateKey.substring(0, 6) + '...' : 'none',
              pendingBlocks: walletInfo.pending?.blocks || []
            }
          });
        } else {
          res.status(500).json({ 
            received: false, 
            count: 0, 
            totalAmount: 0,
            error: processError.message 
          });
        }
      }
    } catch (error: any) {
      console.error('Error in receive pending with options route:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get detailed account information
  app.post('/api/wallet/account-details', async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      if (!walletService.isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      
      // Get account information directly from RPC
      const accountInfo = await walletService.getAccountDetails(address);
      
      return res.json(accountInfo);
    } catch (error: any) {
      console.error('Error getting account details:', error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Get pending transactions with details (POST)
  app.post('/api/wallet/pending', async (req, res) => {
    try {
      const { address, includeDetails } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      if (!walletService.isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      
      // Get pending transactions for this wallet
      const pendingDetails = await walletService.getPendingTransactions(address, includeDetails);
      
      return res.json(pendingDetails);
    } catch (error: any) {
      console.error('Error getting pending transactions:', error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Get pending transactions with details (GET)
  app.get('/api/wallet/pending-transactions', async (req, res) => {
    try {
      const address = req.query.address as string;
      const includeDetails = req.query.include_details === 'true';
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required (query parameter)' });
      }
      
      if (!walletService.isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      
      // Get pending transactions for this wallet
      const pendingDetails = await walletService.getPendingTransactions(address, includeDetails);
      
      return res.json(pendingDetails);
    } catch (error: any) {
      console.error('Error getting pending transactions:', error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/wallet/send', async (req, res) => {
    try {
      const { fromAddress, privateKey, toAddress, amount } = req.body;
      
      if (!fromAddress || !privateKey || !toAddress || !amount) {
        return res.status(400).json({ 
          error: "Missing required parameters: fromAddress, privateKey, toAddress, amount" 
        });
      }
      
      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
      }
      
      // Import the sendXno service
      const { sendXnoService } = await import('./utils/sendXno');
      
      console.log(`Sending ${amountFloat} XNO from ${fromAddress} to ${toAddress}`);
      
      // Use our enhanced send service
      const result = await sendXnoService.sendTransaction(
        fromAddress, 
        privateKey, 
        toAddress, 
        amount.toString()
      );
      
      if (!result.success) {
        console.error('Error sending transaction:', result.error);
        return res.status(400).json({ error: result.error || "Transaction failed" });
      }
      
      console.log(`Transaction successful with hash: ${result.hash}`);
      res.json({ success: true, hash: result.hash });
    } catch (error: any) {
      console.error('Error in send transaction:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/wallet/generate', async (req, res) => {
    try {
      const wallet = await walletService.generateWallet();
      res.json(wallet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/wallet/deposit-qr', async (req, res) => {
    try {
      const { address, amount } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const qrCodeUrl = walletService.getDepositQrCodeUrl(address, amount);
      res.json({ qrCodeUrl });
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
