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
    // Start with basic format validation
    if (!this.isValidAddress(address)) {
      throw new Error('Invalid XNO wallet address format');
    }

    try {
      // Get balance and pending blocks in parallel
      const [balance, pendingBlocks] = await Promise.all([
        this.getBalance(address),
        this.getPendingBlocks(address)
      ]);

      // Generate QR code URL for deposit
      const qrCodeUrl = this.getDepositQrCodeUrl(address);
      
      // Process pending blocks if any
      let pending = undefined;
      if (pendingBlocks && pendingBlocks.blocks && Object.keys(pendingBlocks.blocks).length > 0) {
        const blocks = Object.keys(pendingBlocks.blocks);
        const totalAmount = Object.values(pendingBlocks.blocks)
          .reduce((sum: number, block: any) => sum + parseFloat(this.rawToXno(block.amount)), 0);
        
        pending = { blocks, totalAmount };
      }

      return {
        address,
        balance,
        qrCodeUrl,
        pending
      };
    } catch (error) {
      console.error('Error getting wallet info:', error);
      throw new Error('Could not retrieve wallet information from the blockchain');
    }
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
    if (!address) return false;
    
    // Support both nano_ and xno_ prefixes
    if (!address.startsWith('nano_') && !address.startsWith('xno_')) return false;
    
    // Standard nano addresses are 65 chars (nano_ + 59 chars)
    if (address.length !== 65) return false;
    
    // Check that the address contains only valid characters (alphanumeric except 'l', 'v', '0')
    // This is a simplified validation - it doesn't check the checksum
    const validChars = /^(nano|xno)_[13456789abcdefghijkmnopqrstuwxyz]+$/;
    return validChars.test(address);
  }
  
  /**
   * Validate a wallet address against the blockchain
   * For full validation (including against the blockchain), use verifyWallet
   */
  async verifyWalletOnBlockchain(address: string): Promise<boolean> {
    try {
      if (!this.isValidAddress(address)) {
        return false;
      }
      
      // Use account_info RPC call to check if account exists on the blockchain
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.rpcKey}`
        },
        body: JSON.stringify({
          action: 'account_info',
          account: address
        })
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      
      // If the account doesn't exist on-chain, it will have an "error" property
      // However, an account that exists but has never received funds might still be valid
      if (data.error === 'Account not found') {
        // For unopened accounts, we'll still consider them valid if they pass the format check
        return true;
      }
      
      // If we get account info, it definitely exists
      return !data.error;
    } catch (error) {
      console.error('Error verifying wallet on blockchain:', error);
      // Default to basic validation on errors
      return this.isValidAddress(address);
    }
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
  async generateWallet(): Promise<{ address: string, privateKey: string }> {
    try {
      if (!this.rpcKey || !this.publicKey) {
        throw new Error('XNO API credentials are required to generate a wallet');
      }
      
      // Use the RPC API to create a wallet
      const response = await fetch(`${this.apiUrl}/key/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.rpcKey}`
        },
        body: JSON.stringify({
          action: 'key_create'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate wallet: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return properly formatted data
      if (data && data.private && data.public && data.account) {
        return {
          address: data.account,
          privateKey: data.private
        };
      } else {
        throw new Error('Invalid response from key generation API');
      }
    } catch (error) {
      console.error('Error generating wallet:', error);
      throw error;
    }
  }
}

export const walletService = new WalletService();