/**
 * XNO Sending Service
 * Handles real XNO transactions using the Nano RPC API
 */

import * as nanocurrency from 'nanocurrency-web';
import fetch from 'node-fetch';

interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

class SendXnoService {
  private apiUrl: string;
  private rpcKey: string;
  private gpuKey?: string;

  constructor() {
    // Read RPC credentials from environment variables
    this.apiUrl = process.env.RPC_URL || 'https://rpc.nano.to/';
    this.rpcKey = process.env.RPC_KEY || ''; // Will be empty if not configured
    this.gpuKey = process.env.GPU_KEY || undefined; // For work_generate
    
    console.log('=== USING REAL XNO BLOCKCHAIN API ===');
    console.log('Connecting to Nano RPC API with provided credentials');
    console.log('All wallet verifications and payments will use real blockchain data');
    console.log('=======================================');
  }

  /**
   * Send XNO from one wallet to another
   * @param fromAddress Sender's wallet address
   * @param privateKey Sender's private key
   * @param toAddress Recipient's wallet address
   * @param amount Amount to send in XNO
   * @returns Transaction result with hash or error
   */
  async sendTransaction(
    fromAddress: string,
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<TransactionResult> {
    try {
      // Validate parameters
      if (!this.isValidAddress(fromAddress) || !this.isValidAddress(toAddress)) {
        return {
          success: false,
          error: 'Invalid wallet address format'
        };
      }

      if (!privateKey || privateKey.length < 60) {
        return {
          success: false,
          error: 'Invalid private key format'
        };
      }

      if (!amount || parseFloat(amount) <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than zero'
        };
      }

      // Convert amount to raw
      const rawAmount = nanocurrency.tools.convert(amount, 'XNO', 'raw');
      
      // Get account info for the sender
      const accountInfo = await this.getAccountInfo(fromAddress);
      
      if (!accountInfo || accountInfo.error === 'Account not found') {
        return {
          success: false,
          error: 'Sender account not found or has no previous blocks'
        };
      }
      
      // Check if the account has enough balance
      const balanceRaw = accountInfo.balance || '0';
      if (BigInt(balanceRaw) < BigInt(rawAmount)) {
        return {
          success: false,
          error: `Insufficient balance: ${nanocurrency.tools.convert(balanceRaw, 'raw', 'XNO')} XNO available, ${amount} XNO needed`
        };
      }
      
      // Create block with proper previous, representative, etc.
      const blockData = {
        walletAccount: fromAddress,
        toAddress,
        amount: rawAmount,
        frontier: accountInfo.frontier,
        representative: accountInfo.representative || fromAddress,
        balance: accountInfo.balance || '0',
        privateKey
      };
      
      // Process the send transaction
      const result = await this.processSendBlock(blockData);
      
      return result;
    } catch (error: any) {
      console.error('Error sending XNO:', error);
      return {
        success: false,
        error: error.message || 'Failed to send XNO'
      };
    }
  }

  /**
   * Process a send block for an XNO transaction
   */
  private async processSendBlock(blockData: {
    walletAccount: string;
    toAddress: string;
    amount: string;
    frontier: string;
    representative: string;
    balance: string;
    privateKey: string;
  }): Promise<TransactionResult> {
    try {
      // Calculate new balance after sending
      const newBalanceRaw = (BigInt(blockData.balance) - BigInt(blockData.amount)).toString();
      
      // Create a state block
      const block = {
        type: 'state',
        account: blockData.walletAccount,
        previous: blockData.frontier,
        representative: blockData.representative,
        balance: newBalanceRaw,
        link: this.addressToPublicKey(blockData.toAddress)
      };
      
      // Calculate hash
      // Convert the block to a signable block hash
      const blockHash = nanocurrency.block.createBlock(block.account, {
        previous: block.previous,
        representative: block.representative,
        balance: block.balance,
        link: block.link
      });
      
      // Generate PoW for the transaction
      const workResult = await this.generateWork(blockData.frontier);
      
      if (!workResult.work) {
        return {
          success: false,
          error: workResult.error || 'Failed to generate work for transaction'
        };
      }
      
      // Sign the block using the signing tools
      const signature = nanocurrency.tools.sign(blockData.privateKey, blockHash);
      
      // Build the complete block for processing
      const processBlock = {
        block: {
          type: 'state',
          account: blockData.walletAccount,
          previous: blockData.frontier,
          representative: blockData.representative,
          balance: newBalanceRaw,
          link: this.addressToPublicKey(blockData.toAddress),
          work: workResult.work,
          signature: signature
        },
        subtype: 'send',
        json_block: true
      };
      
      // Process the block through RPC
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'process',
          ...processBlock
        })
      });
      
      const result = await response.json();
      
      if (result.hash) {
        return {
          success: true,
          hash: result.hash
        };
      } else if (result.error) {
        return {
          success: false,
          error: result.error
        };
      } else {
        return {
          success: false,
          error: 'Unknown error processing the transaction'
        };
      }
    } catch (error: any) {
      console.error('Error processing send block:', error);
      return {
        success: false,
        error: error.message || 'Failed to process the transaction'
      };
    }
  }

  /**
   * Get account information from the Nano RPC
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
      
      return await response.json();
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  /**
   * Generate work for a block
   */
  private async generateWork(hash: string): Promise<{ work?: string; error?: string }> {
    try {
      // Prepare headers with GPU key if available for faster work generation
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.rpcKey) {
        headers['Authorization'] = this.rpcKey;
      }
      
      if (this.gpuKey) {
        headers['X-GPU-Key'] = this.gpuKey;
      }
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'work_generate',
          hash: hash,
          difficulty: 'fffffff800000000'  // Current default difficulty
        })
      });
      
      const result = await response.json();
      
      if (result.work) {
        return { work: result.work };
      } else {
        return { error: result.error || 'Failed to generate work' };
      }
    } catch (error: any) {
      console.error('Error generating work:', error);
      return { error: error.message || 'Error generating work' };
    }
  }

  /**
   * Convert a Nano address to its public key (account)
   */
  private addressToPublicKey(address: string): string {
    // Extract the public key from the address
    return nanocurrency.tools.addressToPublicKey(address);
  }

  /**
   * Check if a string is a valid Nano address
   */
  isValidAddress(address: string): boolean {
    // Using the tools.validateAddress method from nanocurrency library
    return nanocurrency.tools.validateAddress(address);
  }
}

export const sendXnoService = new SendXnoService();