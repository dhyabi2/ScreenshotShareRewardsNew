import { Content, InsertContent, Like, InsertLike, Payment, InsertPayment, Report, InsertReport, DailyPool, InsertDailyPool } from "@shared/schema";

export interface IStorage {
  // Content operations
  getAllContent(): Promise<Content[]>;
  getContent(id: number): Promise<Content | undefined>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: number, content: Partial<Content>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<boolean>;
  getContentByWallet(walletAddress: string): Promise<Content[]>;
  getUploadCountByWallet(walletAddress: string, since: Date): Promise<number>;
  
  // Like operations
  addLike(like: InsertLike): Promise<Like>;
  removeLike(contentId: number, walletAddress: string): Promise<boolean>;
  hasLiked(contentId: number, walletAddress: string): Promise<boolean>;
  getLikesByContent(contentId: number): Promise<Like[]>;
  getLikesByWallet(walletAddress: string): Promise<Like[]>;
  
  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: number): Promise<Payment | undefined>;
  updatePayment(id: number, payment: Partial<Payment>): Promise<Payment | undefined>;
  getPaymentsByWallet(walletAddress: string): Promise<Payment[]>;
  checkPayment(fromWallet: string, toWallet: string, amount: number, contentId?: number): Promise<boolean>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReports(): Promise<Report[]>;
  getUnresolvedReports(): Promise<Report[]>;
  resolveReport(id: number, status: string): Promise<Report | undefined>;
  
  // Daily pool operations
  setDailyPool(pool: InsertDailyPool): Promise<DailyPool>;
  getDailyPool(): Promise<DailyPool | undefined>;
  getEstimatedEarnings(walletAddress: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private content: Map<number, Content>;
  private likes: Map<number, Like>;
  private payments: Map<number, Payment>;
  private reports: Map<number, Report>;
  private dailyPool: DailyPool | undefined;
  
  private contentCounter: number;
  private likeCounter: number;
  private paymentCounter: number;
  private reportCounter: number;
  private dailyPoolCounter: number;
  
  constructor() {
    this.content = new Map();
    this.likes = new Map();
    this.payments = new Map();
    this.reports = new Map();
    
    this.contentCounter = 1;
    this.likeCounter = 1;
    this.paymentCounter = 1;
    this.reportCounter = 1;
    this.dailyPoolCounter = 1;
    
    // Initialize with default daily pool
    this.dailyPool = {
      id: this.dailyPoolCounter++,
      totalPool: 1000,
      uploadPoolPercentage: 10,
      likePoolPercentage: 90,
      date: new Date(),
      distributedAt: null
    };
  }
  
  // Content methods
  async getAllContent(): Promise<Content[]> {
    return Array.from(this.content.values());
  }
  
  async getContent(id: number): Promise<Content | undefined> {
    return this.content.get(id);
  }
  
  async createContent(content: InsertContent): Promise<Content> {
    const id = this.contentCounter++;
    const newContent: Content = {
      id,
      ...content,
      likeCount: 0,
      isPaid: content.price <= 0, // Free content is automatically "paid"
      status: "active",
      createdAt: new Date(),
      metadata: {}
    };
    
    this.content.set(id, newContent);
    return newContent;
  }
  
  async updateContent(id: number, updates: Partial<Content>): Promise<Content | undefined> {
    const existingContent = this.content.get(id);
    if (!existingContent) return undefined;
    
    const updatedContent = { ...existingContent, ...updates };
    this.content.set(id, updatedContent);
    return updatedContent;
  }
  
  async deleteContent(id: number): Promise<boolean> {
    return this.content.delete(id);
  }
  
  async getContentByWallet(walletAddress: string): Promise<Content[]> {
    return Array.from(this.content.values()).filter(
      (content) => content.walletAddress === walletAddress
    );
  }
  
  async getUploadCountByWallet(walletAddress: string, since: Date): Promise<number> {
    return Array.from(this.content.values()).filter(
      (content) => 
        content.walletAddress === walletAddress && 
        new Date(content.createdAt) >= since
    ).length;
  }
  
  // Like methods
  async addLike(like: InsertLike): Promise<Like> {
    const id = this.likeCounter++;
    const newLike: Like = {
      id,
      ...like,
      createdAt: new Date()
    };
    
    this.likes.set(id, newLike);
    
    // Update like count on content
    const content = await this.getContent(like.contentId);
    if (content) {
      await this.updateContent(content.id, { 
        likeCount: content.likeCount + 1 
      });
      
      // If this is a paid upvote, record the payment
      if (like.amountPaid && like.creatorTxHash && like.poolTxHash) {
        const totalAmount = parseFloat(like.amountPaid.toString());
        
        // Create a payment record for the creator (80%)
        if (like.creatorWallet) {
          await this.createPayment({
            fromWallet: like.walletAddress,
            toWallet: like.creatorWallet,
            amount: totalAmount * 0.8,
            contentId: like.contentId,
            type: 'payment',
            txHash: like.creatorTxHash
          });
        }
        
        // Create a payment record for the pool (20%)
        await this.createPayment({
          fromWallet: like.walletAddress,
          toWallet: process.env.PUBLIC_POOL_ADDRESS || '',
          amount: totalAmount * 0.2,
          contentId: like.contentId,
          type: 'payment',
          txHash: like.poolTxHash
        });
      }
    }
    
    return newLike;
  }
  
  async removeLike(contentId: number, walletAddress: string): Promise<boolean> {
    let removed = false;
    
    for (const [id, like] of this.likes.entries()) {
      if (like.contentId === contentId && like.walletAddress === walletAddress) {
        this.likes.delete(id);
        removed = true;
        break;
      }
    }
    
    // Update like count on content
    if (removed) {
      const content = await this.getContent(contentId);
      if (content && content.likeCount > 0) {
        await this.updateContent(content.id, { 
          likeCount: content.likeCount - 1 
        });
      }
    }
    
    return removed;
  }
  
  async hasLiked(contentId: number, walletAddress: string): Promise<boolean> {
    return Array.from(this.likes.values()).some(
      (like) => like.contentId === contentId && like.walletAddress === walletAddress
    );
  }
  
  async getLikesByContent(contentId: number): Promise<Like[]> {
    return Array.from(this.likes.values()).filter(
      (like) => like.contentId === contentId
    );
  }
  
  async getLikesByWallet(walletAddress: string): Promise<Like[]> {
    return Array.from(this.likes.values()).filter(
      (like) => like.walletAddress === walletAddress
    );
  }
  
  // Payment methods
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = this.paymentCounter++;
    const newPayment: Payment = {
      id,
      ...payment,
      verified: false,
      createdAt: new Date()
    };
    
    this.payments.set(id, newPayment);
    
    // If this is a content payment, mark the content as paid
    if (payment.type === 'payment' && payment.contentId) {
      const content = await this.getContent(payment.contentId);
      if (content) {
        await this.updateContent(content.id, { isPaid: true });
      }
    }
    
    return newPayment;
  }
  
  async getPayment(id: number): Promise<Payment | undefined> {
    return this.payments.get(id);
  }
  
  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined> {
    const existingPayment = this.payments.get(id);
    if (!existingPayment) return undefined;
    
    const updatedPayment = { ...existingPayment, ...updates };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }
  
  async getPaymentsByWallet(walletAddress: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      (payment) => 
        payment.fromWallet === walletAddress || 
        payment.toWallet === walletAddress
    );
  }
  
  async checkPayment(fromWallet: string, toWallet: string, amount: number, contentId?: number): Promise<boolean> {
    // Check if a matching payment exists
    const paymentExists = Array.from(this.payments.values()).some(
      (payment) => 
        payment.fromWallet === fromWallet && 
        payment.toWallet === toWallet && 
        parseFloat(payment.amount.toString()) === amount &&
        (contentId === undefined || payment.contentId === contentId)
    );
    
    return paymentExists;
  }
  
  // Report methods
  async createReport(report: InsertReport): Promise<Report> {
    const id = this.reportCounter++;
    const newReport: Report = {
      id,
      ...report,
      resolved: false,
      createdAt: new Date()
    };
    
    this.reports.set(id, newReport);
    
    // Mark content as flagged
    if (report.contentId) {
      const content = await this.getContent(report.contentId);
      if (content) {
        await this.updateContent(content.id, { status: "flagged" });
      }
    }
    
    return newReport;
  }
  
  async getReports(): Promise<Report[]> {
    return Array.from(this.reports.values());
  }
  
  async getUnresolvedReports(): Promise<Report[]> {
    return Array.from(this.reports.values()).filter(
      (report) => !report.resolved
    );
  }
  
  async resolveReport(id: number, status: string): Promise<Report | undefined> {
    const report = this.reports.get(id);
    if (!report) return undefined;
    
    const updatedReport = { ...report, resolved: true };
    this.reports.set(id, updatedReport);
    
    // Update content status based on resolution
    const content = await this.getContent(report.contentId);
    if (content) {
      await this.updateContent(content.id, { status });
    }
    
    return updatedReport;
  }
  
  // Daily pool methods
  async setDailyPool(pool: InsertDailyPool): Promise<DailyPool> {
    const id = this.dailyPoolCounter++;
    const newPool: DailyPool = {
      id,
      ...pool,
      date: new Date(),
      distributedAt: null
    };
    
    this.dailyPool = newPool;
    return newPool;
  }
  
  async getDailyPool(): Promise<DailyPool | undefined> {
    return this.dailyPool;
  }
  
  async getEstimatedEarnings(walletAddress: string): Promise<number> {
    if (!this.dailyPool) return 0;
    
    const pool = this.dailyPool;
    const totalPool = parseFloat(pool.totalPool.toString());
    const uploadPoolPercentage = pool.uploadPoolPercentage / 100;
    const likePoolPercentage = pool.likePoolPercentage / 100;
    
    // Get all content for this wallet
    const userContent = await this.getContentByWallet(walletAddress);
    
    // Calculate upload reward
    const totalContent = (await this.getAllContent()).length;
    let uploadReward = 0;
    if (totalContent > 0) {
      const uploadPoolAmount = totalPool * uploadPoolPercentage;
      uploadReward = (userContent.length / totalContent) * uploadPoolAmount;
    }
    
    // Calculate like reward
    let likeReward = 0;
    const totalLikes = Array.from(this.likes.values()).length;
    if (totalLikes > 0) {
      const likePoolAmount = totalPool * likePoolPercentage;
      const userContentLikes = userContent.reduce((sum, content) => sum + content.likeCount, 0);
      
      // Cap the maximum reward per image at 5% of the like pool
      const maxRewardPerContent = likePoolAmount * 0.05;
      
      // Calculate actual rewards based on likes
      likeReward = userContent.reduce((total, content) => {
        const contentLikeShare = content.likeCount / totalLikes;
        const contentReward = contentLikeShare * likePoolAmount;
        return total + Math.min(contentReward, maxRewardPerContent);
      }, 0);
    }
    
    return uploadReward + likeReward;
  }
}

export const storage = new MemStorage();
