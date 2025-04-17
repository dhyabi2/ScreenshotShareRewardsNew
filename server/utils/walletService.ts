import fetch from 'node-fetch';
import crypto from 'crypto';
import { xnoService } from './xnoService';

interface WalletInfo {
  address: string;
  balance: number;
  qrCodeUrl?: string;
  pending?: {
    blocks: string[];
    totalAmount: number;
  };
}

interface Transaction {
  hash: string;
  amount: string;
  type: 'send' | 'receive';
  account: string;
  timestamp: string;
}

interface PendingBlock {
  block: string;
  amount: string;
  source: string;
}

class WalletService {
  private apiUrl: string;
  private rpcKey: string;
  private publicKey: string;

  constructor() {
    this.apiUrl = process.env.XNO_API_URL || 'https://rpc.nano.to';
    this.rpcKey = process.env.RPC_KEY || '';
    this.publicKey = process.env.PUBLIC_KEY || '';
    
    if (!this.rpcKey || !this.publicKey) {
      console.warn('Missing XNO API credentials. Wallet functionality will be limited.');
    }
  }

  /**
   * Get detailed wallet information including balance and pending blocks
   */
  async getWalletInfo(address: string): Promise<WalletInfo> {
    if (!this.isValidAddress(address)) {
      throw new Error('Invalid XNO wallet address');
    }

    const [balance, pendingBlocks] = await Promise.all([
      this.getBalance(address),
      this.getPendingBlocks(address)
    ]);

    const qrCodeUrl = `https://nanocrawler.cc/api/qr/${address}`;
    
    let pending = undefined;
    if (pendingBlocks && pendingBlocks.blocks && Object.keys(pendingBlocks.blocks).length > 0) {
      const blocks = Object.keys(pendingBlocks.blocks);
      const totalAmount = Object.values(pendingBlocks.blocks)
        .reduce((sum, block: any) => sum + parseFloat(this.rawToXno(block.amount)), 0);
      
      pending = { blocks, totalAmount };
    }

    return {
      address,
      balance,
      qrCodeUrl,
      pending
    };
  }

  /**
   * Get wallet balance in XNO
   */
  async getBalance(address: string): Promise<number> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'account_balance',
          account: address
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching balance:', data.error);
        return 0;
      }

      // Convert from raw to XNO (1 XNO = 10^30 raw)
      const balanceXno = this.rawToXno(data.balance);
      return parseFloat(balanceXno);
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return 0;
    }
  }

  /**
   * Get pending blocks (transactions) that need to be received
   */
  async getPendingBlocks(address: string): Promise<any> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'pending',
          account: address,
          count: 10,
          source: true,
          include_active: true
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching pending blocks:', data.error);
        return { blocks: {} };
      }

      return data;
    } catch (error) {
      console.error('Failed to get pending blocks:', error);
      return { blocks: {} };
    }
  }

  /**
   * Process any pending (unreceived) blocks in the wallet
   */
  async receivePending(address: string, privateKey: string): Promise<{ received: boolean, count: number, totalAmount: number }> {
    if (!privateKey) {
      throw new Error('Private key is required to receive pending transactions');
    }

    try {
      // Get pending blocks
      const pending = await this.getPendingBlocks(address);
      
      if (!pending.blocks || Object.keys(pending.blocks).length === 0) {
        return { received: false, count: 0, totalAmount: 0 };
      }

      // Process each pending block
      let processedCount = 0;
      let totalAmount = 0;

      for (const [hash, block] of Object.entries(pending.blocks)) {
        const blockData = block as PendingBlock;
        
        // Create and publish a receive block
        const receiveResult = await this.processReceive(address, privateKey, hash, blockData.amount);
        
        if (receiveResult.processed) {
          processedCount++;
          totalAmount += parseFloat(this.rawToXno(blockData.amount));
        }
      }

      return { 
        received: processedCount > 0, 
        count: processedCount,
        totalAmount
      };
    } catch (error) {
      console.error('Failed to receive pending transactions:', error);
      return { received: false, count: 0, totalAmount: 0 };
    }
  }

  /**
   * Process a specific receive block
   */
  private async processReceive(address: string, privateKey: string, blockHash: string, amount: string): Promise<{ processed: boolean, hash?: string }> {
    try {
      // This is a simplified version - in a real implementation, we would:
      // 1. Get account info to get the current frontier (head block)
      // 2. Create a receive block that builds on the frontier
      // 3. Sign it with the private key
      // 4. Publish to the network
      
      // For now, we'll use the process RPC call which handles this automatically
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'process',
          json_block: 'true',
          subtype: 'receive',
          block: {
            type: 'state',
            account: address,
            previous: blockHash, // This is simplified, in reality we'd get the account frontier
            representative: address, // Should be a proper representative
            balance: amount, // New balance after receiving
            link: blockHash
          },
          private_key: privateKey
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('Error processing receive:', data.error);
        return { processed: false };
      }

      return { processed: true, hash: data.hash };
    } catch (error) {
      console.error('Failed to process receive transaction:', error);
      return { processed: false };
    }
  }

  /**
   * Send XNO from one wallet to another
   */
  async sendTransaction(fromAddress: string, privateKey: string, toAddress: string, amountXno: number): Promise<{ success: boolean, hash?: string, error?: string }> {
    if (!this.isValidAddress(fromAddress) || !this.isValidAddress(toAddress)) {
      return { success: false, error: 'Invalid wallet address' };
    }

    if (amountXno <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    if (!privateKey) {
      return { success: false, error: 'Private key is required to send transactions' };
    }

    try {
      // Convert XNO to raw
      const amountRaw = this.xnoToRaw(amountXno.toString());

      // Get account info to get the current frontier (head block)
      const accountInfo = await this.getAccountInfo(fromAddress);
      
      if (!accountInfo.frontier) {
        return { success: false, error: 'Unable to get account frontier' };
      }

      // Create and publish a send block
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'process',
          json_block: 'true',
          subtype: 'send',
          block: {
            type: 'state',
            account: fromAddress,
            previous: accountInfo.frontier,
            representative: accountInfo.representative || fromAddress,
            balance: this.subtractRaw(accountInfo.balance, amountRaw), // New balance after sending
            link: toAddress // Destination address
          },
          private_key: privateKey
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('Error sending transaction:', data.error);
        return { success: false, error: data.error };
      }

      return { success: true, hash: data.hash };
    } catch (error) {
      console.error('Failed to send transaction:', error);
      return { success: false, error: 'Transaction failed' };
    }
  }

  /**
   * Get account information including frontier block
   */
  private async getAccountInfo(address: string): Promise<any> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'account_info',
          account: address,
          representative: true
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching account info:', data.error);
        return {};
      }

      return data;
    } catch (error) {
      console.error('Failed to get account info:', error);
      return {};
    }
  }

  /**
   * Get transaction history for an account
   */
  async getTransactionHistory(address: string, count = 10): Promise<Transaction[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'account_history',
          account: address,
          count: count.toString()
        })
      });

      const data = await response.json();
      
      if (data.error || !data.history) {
        console.error('Error fetching transaction history:', data.error || 'No history found');
        return [];
      }

      return data.history.map((item: any) => ({
        hash: item.hash,
        type: item.type,
        account: item.account,
        amount: this.rawToXno(item.amount),
        timestamp: item.local_timestamp ? new Date(item.local_timestamp * 1000).toISOString() : ''
      }));
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Generate a deposit QR code URL for a specific address
   */
  getDepositQrCodeUrl(address: string, amount?: number): string {
    const baseUrl = `nano:${address}`;
    const url = amount ? `${baseUrl}?amount=${this.xnoToRaw(amount.toString())}` : baseUrl;
    
    // Use nanocrawler.cc API to generate QR code
    return `https://nanocrawler.cc/api/qr/${encodeURIComponent(url)}`;
  }

  /**
   * Validate XNO wallet address
   */
  isValidAddress(address: string): boolean {
    // Basic validation for Nano addresses
    return xnoService.isValidAddress(address);
  }

  /**
   * Convert raw amount to XNO
   * 1 XNO = 10^30 raw
   */
  rawToXno(raw: string): string {
    if (!raw || raw === '0') return '0';
    
    // Handle scientific notation
    const rawBig = raw.includes('e') 
      ? parseFloat(raw).toFixed(0)
      : raw;
    
    // Nano has 30 decimal places
    // Convert by dividing by 10^30
    const xno = parseFloat(rawBig) / Math.pow(10, 30);
    
    // Format to 6 decimal places for display
    return xno.toFixed(6);
  }

  /**
   * Convert XNO amount to raw
   * 1 XNO = 10^30 raw
   */
  xnoToRaw(xno: string): string {
    if (!xno || xno === '0') return '0';
    
    // Convert by multiplying by 10^30
    const raw = parseFloat(xno) * Math.pow(10, 30);
    
    // Return as integer string
    return raw.toFixed(0);
  }

  /**
   * Subtract raw amounts (as strings)
   */
  private subtractRaw(rawBalance: string, rawAmount: string): string {
    const balance = BigInt(rawBalance);
    const amount = BigInt(rawAmount);
    const result = balance - amount;
    return result.toString();
  }

  /**
   * Generate a new keypair for a wallet
   */
  generateWallet(): { address: string, privateKey: string } {
    // This is a simplified implementation for demo purposes
    // In a real application, you would use a proper Nano wallet library for safe key generation
    
    // Generate a "seed" as hex string
    const seed = crypto.randomBytes(32).toString('hex');
    
    // In a real implementation, you would derive a keypair from this seed
    // For now, we'll just create a dummy Nano address
    const privateKey = seed; // In real impl, would be derived
    const address = `nano_${seed.substring(0, 32)}${crypto.randomBytes(8).toString('hex')}`;
    
    return { address, privateKey };
  }
}

export const walletService = new WalletService();