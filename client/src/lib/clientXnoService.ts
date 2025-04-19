/**
 * Client-side XNO Transaction Service
 * This handles XNO transactions directly in the browser without sending private keys to the server
 */

import * as nanocurrency from 'nanocurrency-web';
import { api } from './api';

// Type definitions
export interface BlockInfo {
  frontier: string;
  representative: string;
  balance: string;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  message?: string;
}

export interface SendParams {
  fromAddress: string;
  privateKey: string;
  toAddress: string;
  amount: string;
  contentId?: number;
}

/**
 * Client-side XNO transaction service
 * Processes transactions without sending the private key to the server
 */
export const clientXnoService = {
  /**
   * Send XNO transaction entirely from the client
   * @param params Transaction parameters
   */
  async sendTransaction(params: SendParams): Promise<TransactionResult> {
    try {
      const { fromAddress, privateKey, toAddress, amount } = params;

      // Validate addresses using nanocurrency-web
      if (!nanocurrency.tools.validateAddress(fromAddress) || !nanocurrency.tools.validateAddress(toAddress)) {
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

      // Convert amount to raw
      const rawAmount = nanocurrency.tools.convert(amount, 'XNO', 'raw');

      // Get account info without sending the private key
      const accountInfo = await api.getAccountInfo(fromAddress);
      
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

      // Calculate new balance after sending
      const newBalanceRaw = (BigInt(balanceRaw) - BigInt(rawAmount)).toString();
      
      // Convert the receiver's address to a public key (link)
      const linkPublicKey = nanocurrency.tools.addressToPublicKey(toAddress);

      // Create a block template
      const block = {
        account: fromAddress,
        previous: accountInfo.frontier,
        representative: accountInfo.representative || fromAddress,
        balance: newBalanceRaw,
        link: linkPublicKey
      };
      
      // Create the block
      const blockData = nanocurrency.block.createBlock(block.account, {
        previous: block.previous,
        representative: block.representative,
        balance: block.balance,
        link: block.link
      });
      
      // Generate work on the server
      const workResult = await api.generateWork(accountInfo.frontier);
      
      if (!workResult.work) {
        return {
          success: false,
          error: workResult.error || 'Failed to generate work for transaction'
        };
      }
      
      // Sign the block using the private key (client-side only)
      const signature = nanocurrency.tools.sign(privateKey, blockData);
      
      // Process the block on the server (never sending private key)
      const processResult = await api.processBlock({
        block: {
          type: 'state',
          account: fromAddress,
          previous: accountInfo.frontier,
          representative: accountInfo.representative || fromAddress,
          balance: newBalanceRaw,
          link: linkPublicKey,
          work: workResult.work,
          signature: signature
        },
        subtype: 'send'
      });
      
      // Record the payment if contentId is provided (without sending private key)
      if (processResult.hash && params.contentId) {
        await api.recordPayment({
          fromWallet: fromAddress,
          toWallet: toAddress,
          amount: amount,
          hash: processResult.hash,
          contentId: params.contentId,
          type: 'tip'
        });
      }
      
      return {
        success: !!processResult.hash,
        hash: processResult.hash,
        error: processResult.error
      };
    } catch (error: any) {
      console.error('Error sending XNO:', error);
      return {
        success: false,
        error: error.message || 'Failed to send XNO'
      };
    }
  },
  
  /**
   * Send a tip to a creator
   */
  async sendTip(params: SendParams): Promise<TransactionResult> {
    const result = await this.sendTransaction(params);
    return result;
  },
  
  /**
   * Process an upvote with the 80/20 split model
   * - 80% goes to the creator
   * - 20% goes to the reward pool
   */
  async processUpvote(
    fromAddress: string,
    privateKey: string,
    creatorWallet: string,
    contentId: number,
    amount: string
  ): Promise<{
    success: boolean;
    message?: string;
    creatorTx?: string;
    poolTx?: string;
    creatorAmount?: string;
    poolAmount?: string;
    error?: string;
  }> {
    try {
      // Get the pool wallet address
      const poolInfo = await api.getPoolWalletAddress();
      
      if (!poolInfo.address) {
        return {
          success: false,
          error: 'Could not retrieve pool wallet address'
        };
      }
      
      // Calculate the 80/20 split
      const totalRaw = nanocurrency.tools.convert(amount, 'XNO', 'raw');
      const creatorAmount = (BigInt(totalRaw) * BigInt(80) / BigInt(100)).toString();
      const poolAmount = (BigInt(totalRaw) - BigInt(creatorAmount)).toString();
      
      // Convert back to XNO for readability
      const creatorXNO = nanocurrency.tools.convert(creatorAmount, 'raw', 'XNO');
      const poolXNO = nanocurrency.tools.convert(poolAmount, 'raw', 'XNO');
      
      // First, send to creator (80%)
      const creatorResult = await this.sendTransaction({
        fromAddress,
        privateKey,
        toAddress: creatorWallet,
        amount: creatorXNO
      });
      
      if (!creatorResult.success) {
        return {
          success: false,
          error: `Failed to send to creator: ${creatorResult.error}`
        };
      }
      
      // Then, send to pool (20%)
      const poolResult = await this.sendTransaction({
        fromAddress,
        privateKey,
        toAddress: poolInfo.address,
        amount: poolXNO
      });
      
      if (!poolResult.success) {
        return {
          success: false,
          error: `Failed to send to reward pool: ${poolResult.error}`,
          creatorTx: creatorResult.hash,
          creatorAmount: creatorXNO
        };
      }
      
      // Record the upvote transaction (without sending private key)
      await api.recordUpvote({
        fromWallet: fromAddress,
        creatorWallet,
        poolWallet: poolInfo.address,
        contentId,
        totalAmount: amount,
        creatorAmount: creatorXNO,
        poolAmount: poolXNO,
        creatorTxHash: creatorResult.hash,
        poolTxHash: poolResult.hash
      });
      
      return {
        success: true,
        message: `Successfully sent ${creatorXNO} XNO to creator and ${poolXNO} XNO to reward pool`,
        creatorTx: creatorResult.hash,
        poolTx: poolResult.hash,
        creatorAmount: creatorXNO,
        poolAmount: poolXNO
      };
      
    } catch (error: any) {
      console.error('Error processing upvote:', error);
      return {
        success: false,
        error: error.message || 'Failed to process upvote'
      };
    }
  }
};