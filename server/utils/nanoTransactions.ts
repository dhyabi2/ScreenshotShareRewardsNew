/**
 * Nano client-side transaction helper
 * This utility enables client-side block creation and signing for XNO transactions
 * Since we're limited by the RPC endpoint capabilities, this gives us more control
 */

import { isValidXNOAddress } from '../helpers/validators';
import * as nanocurrency from 'nanocurrency';
import * as nacurrency from 'nanocurrency-web';
import fetch from 'node-fetch';

interface BlockData {
  type: string;
  account: string;
  previous: string;
  representative: string;
  balance: string;
  link: string;
  signature?: string;
  work?: string;
}

interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  block?: BlockData;
}

interface Pending {
  blocks: { [key: string]: string | { amount: string } };
}

class NanoTransactions {
  private apiUrl: string;
  private rpcKey: string;
  private gpuKey: string;

  constructor() {
    this.apiUrl = process.env.XNO_RPC_URL || 'https://rpc.nano.to/';
    this.rpcKey = process.env.RPC_KEY || '';
    this.gpuKey = 'RPC-KEY-BAB822FCCDAE42ECB7A331CCAAAA23';
    
    if (!this.rpcKey) {
      console.warn('Warning: No RPC_KEY environment variable found for Nano RPC');
    }
  }

  /**
   * Generate work for a block hash
   */
  async generateWork(hash: string): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey,
          'X-GPU-Key': this.gpuKey
        },
        body: JSON.stringify({
          action: 'work_generate',
          hash: hash,
          difficulty: 'fffffff800000000' // Using standard difficulty
        })
      });

      const data = await response.json() as any;
      
      if (data.error) {
        console.error('Error generating work:', data.error);
        throw new Error(`Work generation failed: ${data.error}`);
      }

      return data.work;
    } catch (error) {
      console.error('Failed to generate work:', error);
      throw error;
    }
  }

  /**
   * Get account information including frontier block
   */
  async getAccountInfo(address: string): Promise<any> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey,
          'X-GPU-Key': this.gpuKey
        },
        body: JSON.stringify({
          action: 'account_info',
          account: address,
          representative: true
        })
      });

      const data = await response.json() as any;
      
      if (data.error) {
        console.log(`Account info error for ${address}: ${data.error}`);
        if (data.error === 'Account not found') {
          return { error: 'Account not found', newAccount: true };
        }
        return { error: data.error };
      }

      return data;
    } catch (error) {
      console.error('Failed to get account info:', error);
      return { error: 'API request failed' };
    }
  }

  /**
   * Get pending blocks for an account
   */
  async getPendingBlocks(address: string): Promise<Pending> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey,
          'X-GPU-Key': this.gpuKey
        },
        body: JSON.stringify({
          action: 'pending',
          account: address,
          source: true,
          include_only_confirmed: true
        })
      });

      const data = await response.json() as any;
      
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
   * Process a block through the node
   */
  async processBlock(block: BlockData): Promise<{ hash?: string; error?: string }> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey,
          'X-GPU-Key': this.gpuKey
        },
        body: JSON.stringify({
          action: 'process',
          json_block: 'true',
          block: block
        })
      });

      const data = await response.json() as any;
      
      if (data.error) {
        console.error('Error processing block:', data.error);
        return { error: data.error };
      }

      return { hash: data.hash };
    } catch (error) {
      console.error('Failed to process block:', error);
      return { error: 'Block processing failed' };
    }
  }

  /**
   * Create and sign an opening block (for new accounts)
   */
  async createOpenBlock(address: string, privateKey: string, sourceBlock: string, sourceAmount: string): Promise<TransactionResult> {
    if (!isValidXNOAddress(address)) {
      return { success: false, error: 'Invalid wallet address format' };
    }

    if (!nanocurrency.checkKey(privateKey)) {
      return { success: false, error: 'Invalid private key' };
    }

    try {
      // Generate the public key from the address
      const publicKey = nanocurrency.derivePublicKey(privateKey);
      
      // For new accounts, use a default representative
      const representative = 'nano_3rropjiqfxpmrrkooej4qtmm1pueu36f9ghinpho4esfdor8785a455d16nf';
      
      // Generate work for the public key (for opening blocks)
      console.log('Generating work for opening block...');
      const work = await this.generateWork(publicKey);
      
      // Create a state block
      const block: BlockData = {
        type: 'state',
        account: address,
        previous: '0000000000000000000000000000000000000000000000000000000000000000',
        representative: representative,
        balance: sourceAmount.toString(), // Ensure balance is a string
        link: sourceBlock,
        work: work
      };
      
      // Convert block to the format expected by nanocurrency.js
      const blockForHash = {
        account: block.account,
        previous: block.previous,
        representative: block.representative,
        balance: block.balance,
        link: block.link
      };
      
      // Create the hash
      const blockHash = nanocurrency.hashBlock(blockForHash);
      block.signature = nanocurrency.signBlock({
        hash: blockHash,
        secretKey: privateKey
      });
      
      console.log('Created and signed opening block with hash:', blockHash);
      
      // Process the block
      const processResult = await this.processBlock(block);
      
      if (processResult.error) {
        return { 
          success: false, 
          error: processResult.error,
          hash: blockHash,
          block: block
        };
      }
      
      return { 
        success: true, 
        hash: processResult.hash || blockHash,
        block: block
      };
    } catch (error) {
      console.error('Error creating opening block:', error);
      return { success: false, error: 'Failed to create opening block' };
    }
  }

  /**
   * Create and sign a receive block (for existing accounts)
   */
  async createReceiveBlock(
    address: string, 
    privateKey: string, 
    sourceBlock: string, 
    sourceAmount: string, 
    accountInfo: any
  ): Promise<TransactionResult> {
    if (!isValidXNOAddress(address)) {
      return { success: false, error: 'Invalid wallet address format' };
    }

    if (!nanocurrency.checkKey(privateKey)) {
      return { success: false, error: 'Invalid private key' };
    }

    try {
      // Use existing representative or default if not found
      const representative = accountInfo.representative || 'nano_3rropjiqfxpmrrkooej4qtmm1pueu36f9ghinpho4esfdor8785a455d16nf';
      
      // Calculate new balance by adding to existing balance
      const currentBalance = accountInfo.balance || '0';
      const newBalance = (BigInt(currentBalance) + BigInt(sourceAmount)).toString();
      
      // Generate work for the previous block (frontier)
      console.log('Generating work for receive block...');
      const work = await this.generateWork(accountInfo.frontier);
      
      // Create a state block
      const block: BlockData = {
        type: 'state',
        account: address,
        previous: accountInfo.frontier,
        representative: representative,
        balance: newBalance,
        link: sourceBlock,
        work: work
      };
      
      // Convert block to the format expected by nanocurrency.js
      const blockForHash = {
        account: block.account,
        previous: block.previous,
        representative: block.representative,
        balance: block.balance,
        link: block.link
      };
      
      // Create the hash
      const blockHash = nanocurrency.hashBlock(blockForHash);
      block.signature = nanocurrency.signBlock({
        hash: blockHash,
        secretKey: privateKey
      });
      
      console.log('Created and signed receive block with hash:', blockHash);
      
      // Process the block
      const processResult = await this.processBlock(block);
      
      if (processResult.error) {
        return { 
          success: false, 
          error: processResult.error,
          hash: blockHash,
          block: block
        };
      }
      
      return { 
        success: true, 
        hash: processResult.hash || blockHash,
        block: block
      };
    } catch (error) {
      console.error('Error creating receive block:', error);
      return { success: false, error: 'Failed to create receive block' };
    }
  }

  /**
   * Create and sign a send block
   */
  async createSendBlock(
    fromAddress: string, 
    privateKey: string, 
    toAddress: string, 
    sendAmount: string, 
    accountInfo: any
  ): Promise<TransactionResult> {
    if (!isValidXNOAddress(fromAddress) || !isValidXNOAddress(toAddress)) {
      return { success: false, error: 'Invalid wallet address format' };
    }

    if (!nanocurrency.checkKey(privateKey)) {
      return { success: false, error: 'Invalid private key' };
    }

    try {
      // Calculate new balance by subtracting from existing balance
      const currentBalance = accountInfo.balance || '0';
      
      if (BigInt(currentBalance) < BigInt(sendAmount)) {
        return { success: false, error: 'Insufficient balance' };
      }
      
      const newBalance = (BigInt(currentBalance) - BigInt(sendAmount)).toString();
      
      // Use existing representative or default if not found
      const representative = accountInfo.representative || fromAddress;
      
      // Generate work for the previous block (frontier)
      console.log('Generating work for send block...');
      const work = await this.generateWork(accountInfo.frontier);
      
      // For send blocks, the link is the public key of the destination account
      const destPublicKey = nacurrency.tools.addressToPublicKey(toAddress);
      
      // Create a state block
      const block: BlockData = {
        type: 'state',
        account: fromAddress,
        previous: accountInfo.frontier,
        representative: representative,
        balance: newBalance,
        link: destPublicKey,
        work: work
      };
      
      // Convert block to the format expected by nanocurrency.js
      const blockForHash = {
        account: block.account,
        previous: block.previous,
        representative: block.representative,
        balance: block.balance,
        link: block.link
      };
      
      // Create the hash
      const blockHash = nanocurrency.hashBlock(blockForHash);
      block.signature = nanocurrency.signBlock({
        hash: blockHash,
        secretKey: privateKey
      });
      
      console.log('Created and signed send block with hash:', blockHash);
      
      // Process the block
      const processResult = await this.processBlock(block);
      
      if (processResult.error) {
        return { 
          success: false, 
          error: processResult.error,
          hash: blockHash,
          block: block
        };
      }
      
      return { 
        success: true, 
        hash: processResult.hash || blockHash,
        block: block
      };
    } catch (error) {
      console.error('Error creating send block:', error);
      return { success: false, error: 'Failed to create send block' };
    }
  }

  /**
   * Receive all pending blocks for an account
   */
  async receiveAllPending(address: string, privateKey: string): Promise<{ received: boolean, count: number, totalAmount: string }> {
    if (!isValidXNOAddress(address)) {
      return { received: false, count: 0, totalAmount: '0' };
    }

    if (!nanocurrency.checkKey(privateKey)) {
      return { received: false, count: 0, totalAmount: '0' };
    }

    try {
      console.log(`Checking pending blocks for ${address}`);
      const pending = await this.getPendingBlocks(address);
      
      if (!pending.blocks || Object.keys(pending.blocks).length === 0) {
        console.log('No pending blocks found');
        return { received: false, count: 0, totalAmount: '0' };
      }
      
      const pendingBlocks = Object.entries(pending.blocks);
      console.log(`Found ${pendingBlocks.length} pending blocks to receive`);
      
      // Get account info
      const accountInfo = await this.getAccountInfo(address);
      const isNewAccount = accountInfo.error === 'Account not found';
      
      let receivedCount = 0;
      let totalAmount = BigInt(0);
      
      // Process each pending block
      for (const [blockHash, amount] of pendingBlocks) {
        // Make sure amount is a string - handle different API response formats
        let amountStr: string;
        if (typeof amount === 'object' && amount !== null) {
          // Some APIs return {amount: "value"} format
          amountStr = amount.amount ? amount.amount.toString() : '0';
        } else {
          // Others return the value directly
          amountStr = amount?.toString() || '0';
        }
        console.log(`Processing block ${blockHash} with amount ${amount} for ${address}`);
        
        let result;
        
        if (isNewAccount && receivedCount === 0) {
          // For new accounts, first block is an open block
          result = await this.createOpenBlock(address, privateKey, blockHash, amountStr);
        } else {
          // After the first receive, we need to get fresh account info for each subsequent receive
          const freshAccountInfo = await this.getAccountInfo(address);
          
          if (freshAccountInfo.error) {
            console.error(`Error getting account info for subsequent receive: ${freshAccountInfo.error}`);
            continue;
          }
          
          result = await this.createReceiveBlock(address, privateKey, blockHash, amountStr, freshAccountInfo);
        }
        
        if (result.success) {
          receivedCount++;
          totalAmount = totalAmount + BigInt(amountStr);
          console.log(`Successfully received block ${blockHash} with hash ${result.hash}`);
        } else {
          console.error(`Failed to receive block ${blockHash}: ${result.error}`);
        }
      }
      
      return {
        received: receivedCount > 0,
        count: receivedCount,
        totalAmount: totalAmount.toString()
      };
    } catch (error) {
      console.error('Error receiving pending blocks:', error);
      return { received: false, count: 0, totalAmount: '0' };
    }
  }
}

export const nanoTransactions = new NanoTransactions();