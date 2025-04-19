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
  checkPayment: async (fromWallet: string, toWallet: string, amount: number, contentId?: string): Promise<{ paid: boolean, method?: string }> => {
    const response = await fetch("/api/payment/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromWallet, to: toWallet, amount, contentId })
    });
    
    if (!response.ok) {
      throw new Error("Failed to check payment");
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
  }
};
