import { Content, DailyPoolStats, WalletInfo, PaymentInfo, EnhancedWalletInfo, Transaction } from "@/types";
import { apiRequest } from "./queryClient";

export const api = {
  // Content endpoints
  uploadContent: async (formData: FormData): Promise<Content> => {
    const response = await fetch("/api/content/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }
    
    return response.json();
  },
  
  getAllContent: async (): Promise<Content[]> => {
    const response = await fetch("/api/content");
    if (!response.ok) {
      throw new Error("Failed to fetch content");
    }
    return response.json();
  },
  
  getContent: async (id: string): Promise<Content> => {
    const response = await fetch(`/api/content/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch content details");
    }
    return response.json();
  },
  
  getContentByWallet: async (walletAddress: string): Promise<Content[]> => {
    const response = await fetch(`/api/content/wallet/${walletAddress}`);
    if (!response.ok) {
      throw new Error("Failed to fetch wallet content");
    }
    return response.json();
  },
  
  likeContent: async (contentId: string, walletAddress: string): Promise<Content> => {
    const response = await fetch(`/api/content/${contentId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress })
    });
    
    if (!response.ok) {
      throw new Error("Failed to like content");
    }
    
    return response.json();
  },
  
  reportContent: async (contentId: string, reason: string): Promise<void> => {
    await apiRequest("POST", `/api/content/${contentId}/report`, { reason });
  },
  
  // Wallet endpoints
  verifyWallet: async (address: string): Promise<WalletInfo> => {
    const response = await fetch("/api/wallet/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });
    
    if (!response.ok) {
      throw new Error("Failed to verify wallet");
    }
    
    return response.json();
  },
  
  getWalletBalance: async (address: string): Promise<{ balance: number }> => {
    const res = await apiRequest("POST", "/api/wallet/balance", { address });
    return res.json();
  },
  
  // Enhanced wallet endpoints
  getWalletInfo: async (address: string): Promise<{
    address: string;
    balance: number;
    qrCodeUrl?: string;
    pending?: {
      blocks: string[];
      totalAmount: number;
    };
  }> => {
    const res = await apiRequest("POST", "/api/wallet/info", { address });
    return res.json();
  },
  
  getWalletTransactions: async (address: string, count?: number): Promise<{
    transactions: Array<{
      hash: string;
      type: string;
      account: string;
      amount: string;
      timestamp: string;
    }>;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/transactions", { address, count });
    return res.json();
  },
  
  receivePending: async (address: string, privateKey: string): Promise<{
    received: boolean;
    count: number;
    totalAmount: number;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/receive", { address, privateKey });
    return res.json();
  },
  
  sendTransaction: async (fromAddress: string, privateKey: string, toAddress: string, amount: number): Promise<{
    success: boolean;
    hash?: string;
    error?: string;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/send", { 
      fromAddress, 
      privateKey, 
      toAddress, 
      amount 
    });
    return res.json();
  },
  
  generateWallet: async (): Promise<{
    address: string;
    privateKey: string;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/generate");
    return res.json();
  },
  
  importWallet: async (privateKey: string): Promise<{
    address: string;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/import", { privateKey });
    return res.json();
  },
  
  getAccountInfo: async (address: string): Promise<any> => {
    const res = await apiRequest("POST", "/api/wallet/account-details", { address });
    return res.json();
  },
  
  receivePendingWithOptions: async (address: string, privateKey: string, options: any): Promise<{
    received: boolean;
    count: number;
    totalAmount: number;
    processedBlocks?: Array<{
      blockHash: string;
      amount: string;
      success: boolean;
      error?: string;
    }>;
    error?: string;
    debug?: any;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/receive-with-options", { 
      address, 
      privateKey,
      workThreshold: options.workThreshold,
      maxRetries: options.maxRetries || 5,
      debug: options.debug !== undefined ? options.debug : true // Enable debug by default for better troubleshooting
    });
    
    try {
      return await res.json();
    } catch(e) {
      console.error("Failed to parse receive response:", e);
      return {
        received: false,
        count: 0,
        totalAmount: 0,
        error: "Failed to parse server response"
      };
    }
  },
  
  getDepositQrCode: async (address: string, amount?: number): Promise<{
    qrCodeUrl: string;
  }> => {
    const res = await apiRequest("POST", "/api/wallet/deposit-qr", { address, amount });
    return res.json();
  },
  
  // Payment endpoints
  checkPayment: async (params: { from: string, to: string, amount: number, contentId?: number }): Promise<{ paid: boolean, method?: string }> => {
    const response = await fetch("/api/payment/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error("Failed to check payment");
    }
    
    return response.json();
  },
  
  // Send tip using real XNO transaction via the backend
  sendTip: async (params: { 
    fromAddress: string, 
    privateKey: string, 
    toAddress: string, 
    amount: number | string, 
    contentId?: number 
  }): Promise<{
    success: boolean;
    hash?: string;
    message?: string;
    error?: string;
  }> => {
    const response = await fetch("/api/wallet/send-tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to send tip");
    }
    
    return response.json();
  },
  
  // New client-side transaction endpoints
  getAccountInfo: async (address: string): Promise<any> => {
    const response = await fetch("/api/wallet/account-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get account info");
    }
    
    return response.json();
  },
  
  generateWork: async (hash: string): Promise<{ work?: string; error?: string }> => {
    const response = await fetch("/api/wallet/generate-work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate work");
    }
    
    return response.json();
  },
  
  processBlock: async (blockData: any): Promise<{ hash?: string; error?: string }> => {
    const response = await fetch("/api/wallet/process-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to process block");
    }
    
    return response.json();
  },
  
  recordPayment: async (paymentData: {
    fromWallet: string;
    toWallet: string;
    amount: string;
    hash: string;
    contentId?: number;
    type: 'payment' | 'tip';
  }): Promise<{ success: boolean; id?: number; error?: string }> => {
    const response = await fetch("/api/payment/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to record payment");
    }
    
    return response.json();
  },
  
  recordUpvote: async (upvoteData: {
    fromWallet: string;
    creatorWallet: string;
    poolWallet: string;
    contentId: number;
    totalAmount: string;
    creatorAmount: string;
    poolAmount: string;
    creatorTxHash?: string;
    poolTxHash?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const response = await fetch("/api/rewards/record-upvote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upvoteData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to record upvote");
    }
    
    return response.json();
  },
  
  getPoolWalletAddress: async (): Promise<{ address: string }> => {
    const response = await fetch("/api/rewards/pool-address");
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get pool wallet address");
    }
    
    return response.json();
  },
  
  // Rewards endpoints
  getDailyPoolStats: async (): Promise<DailyPoolStats> => {
    const response = await fetch("/api/rewards/pool-stats");
    if (!response.ok) {
      throw new Error("Failed to fetch daily pool stats");
    }
    return response.json();
  },
  
  getEstimatedEarnings: async (walletAddress: string): Promise<{ estimatedEarnings: number }> => {
    const response = await fetch(`/api/rewards/estimated-earnings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress })
    });
    if (!response.ok) {
      throw new Error("Failed to fetch estimated earnings");
    }
    return response.json();
  },
  
  /**
   * Process an upvote payment with the 80/20 Self-Sustained Model
   * - 80% of payment goes to content creator
   * - 20% of payment goes to reward pool
   */
  processUpvote: async (
    fromWallet: string, 
    privateKey: string, 
    creatorWallet: string, 
    contentId: number, 
    amount: number = 0.01
  ): Promise<{
    success: boolean;
    message?: string;
    creatorTx?: string;
    poolTx?: string;
    amountPaid?: number;
    creatorAmount?: number;
    poolAmount?: number;
    error?: string;
  }> => {
    const response = await fetch('/api/rewards/process-upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromWallet,
        privateKey,
        creatorWallet,
        contentId,
        amount
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process upvote payment');
    }
    
    return response.json();
  }
};
