export interface Content {
  id: string;
  title: string;
  type: "image" | "video";
  originalUrl: string;
  blurredUrl: string;
  price: number;
  walletAddress: string;
  likeCount: number;
  createdAt: string;
  durationSeconds?: number;
  isPaid: boolean;
  status: "active" | "flagged" | "removed";
}

export interface DailyPoolStats {
  totalPool: number;
  uploadPoolPercentage: number;
  likePoolPercentage: number;
  uploadPool: number;
  likePool: number;
  totalUploads: number;
  totalLikes: number;
  estimatedEarnings: number;
}

export interface UploadFormData {
  file: File | null;
  title: string;
  price: number;
  walletAddress: string;
}

export interface WalletInfo {
  address: string;
  balance: number;
  valid: boolean;
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
  amount: string;
  type: 'send' | 'receive';
  account: string;
  timestamp: string;
}

export interface PaymentInfo {
  from: string;
  to: string;
  amount: number;
  contentId: string;
  paid: boolean;
}
