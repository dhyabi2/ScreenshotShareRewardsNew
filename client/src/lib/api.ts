import { Content, DailyPoolStats, WalletInfo, PaymentInfo } from "@/types";
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
  
  likeContent: async (contentId: string, walletAddress: string): Promise<Content> => {
    const res = await apiRequest("POST", `/api/content/${contentId}/like`, { walletAddress });
    return res.json();
  },
  
  reportContent: async (contentId: string, reason: string): Promise<void> => {
    await apiRequest("POST", `/api/content/${contentId}/report`, { reason });
  },
  
  // Wallet endpoints
  verifyWallet: async (address: string): Promise<WalletInfo> => {
    const res = await apiRequest("POST", "/api/wallet/verify", { address });
    return res.json();
  },
  
  getWalletBalance: async (address: string): Promise<{ balance: number }> => {
    const res = await apiRequest("POST", "/api/wallet/balance", { address });
    return res.json();
  },
  
  // Payment endpoints
  checkPayment: async (paymentInfo: Omit<PaymentInfo, "paid">): Promise<PaymentInfo> => {
    const res = await apiRequest("POST", "/api/payment/check", paymentInfo);
    return res.json();
  },
  
  // Rewards endpoints
  getDailyPoolStats: async (): Promise<DailyPoolStats> => {
    const response = await fetch("/api/rewards/pool-stats");
    if (!response.ok) {
      throw new Error("Failed to fetch daily pool stats");
    }
    return response.json();
  },
  
  getUserEstimatedEarnings: async (walletAddress: string): Promise<{ estimatedEarnings: number }> => {
    const res = await apiRequest("POST", "/api/rewards/estimated-earnings", { walletAddress });
    return res.json();
  }
};
