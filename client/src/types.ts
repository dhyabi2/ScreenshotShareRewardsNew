// Content Types
export interface Content {
  id: number;
  walletAddress: string; 
  title: string;
  type: 'image' | 'video';
  originalUrl: string;
  blurredUrl: string;
  price: string;
  likeCount: number;
  durationSeconds: number | null;
  isPaid: boolean;
  status: 'active' | 'flagged' | 'removed';
  createdAt: Date;
}

// Wallet Types
export interface WalletInfo {
  address: string;
  balance?: number;
}

export interface EnhancedWalletInfo {
  address: string;
  balance: number;
  qrCodeUrl?: string;
  pending?: {
    blocks: string[];
    totalAmount: number;
  };
}

export interface Transaction {
  hash: string;
  type: 'send' | 'receive';
  account: string;
  amount: string;
  timestamp: string;
}

// Payment Types
export interface PaymentInfo {
  id: number;
  fromWallet: string;
  toWallet: string;
  amount: number;
  contentId?: number;
  type: 'payment' | 'tip';
  status: 'pending' | 'completed';
  createdAt: Date;
}

// Rewards Types
export interface DailyPoolStats {
  totalPool: number;
  uploadPoolPercentage: number;
  likePoolPercentage: number;
  uploadPool: number;
  likePool: number;
  totalUploads: number;
  totalLikes: number;
}

// Report Types
export interface ReportInfo {
  id: number;
  contentId: number;
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: Date;
}

// Transaction Types
export interface SendTransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export interface TipResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

// Upvote Types
export interface UpvoteResult {
  success: boolean;
  message?: string;
  creatorTx?: string;
  poolTx?: string;
  amountPaid?: number;
  creatorAmount?: number;
  poolAmount?: number;
  error?: string;
}