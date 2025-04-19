/**
 * Specialized utility for sending XNO transactions
 * Following the Nano RPC protocol documentation
 */

import { isValidXNOAddress } from '../helpers/validators';
import nanocurrency from 'nanocurrency';
import * as nanocurrencyWeb from 'nanocurrency-web';

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

export class SendXnoService {
  private apiUrl: string;
  private rpcKey: string;
  private gpuKey: string;

  constructor() {
    this.apiUrl = 'https://rpc.nano.to/';
    this.rpcKey = process.env.RPC_KEY || '';
    this.gpuKey = process.env.PUBLIC_KEY || '';
  }

  /**
   * Send XNO from one address to another
   * Implements the Nano RPC protocol's send functionality
   */
  async sendTransaction(
    fromAddress: string,
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<TransactionResult> {
    try {
      // Validate addresses
      if (!isValidXNOAddress(fromAddress) || !isValidXNOAddress(toAddress)) {
        console.log('Invalid wallet address format');
        return { success: false, error: 'Invalid wallet address format' };
      }

      // Normalize the private key
      const normalizedKey = privateKey.trim().toLowerCase();
      console.log(`Sending ${amount} XNO from ${fromAddress} to ${toAddress}`);
      
      // Validate the private key
      if (!nanocurrency.checkKey(normalizedKey)) {
        console.log(`Private key validation failed for send`);
        
        // Continue only if it's a valid hex string
        if (!/^[0-9a-f]{64}$/i.test(normalizedKey)) {
          return { success: false, error: 'Invalid private key format: must be a 64-character hex string' };
        }
      }
      
      // Convert amount to raw (smallest unit)
      const rawAmount = this.convertToRaw(amount);
      console.log(`Amount in raw: ${rawAmount}`);
      
      // Get the source account info
      const accountInfo = await this.getAccountInfo(fromAddress);
      if (accountInfo.error) {
        return { success: false, error: `Could not get account info: ${accountInfo.error}` };
      }
      
      // Check if account has sufficient balance
      const currentBalance = accountInfo.balance || '0';
      if (BigInt(currentBalance) < BigInt(rawAmount)) {
        return { success: false, error: 'Insufficient balance' };
      }
      
      // Calculate new balance after send
      const newBalance = (BigInt(currentBalance) - BigInt(rawAmount)).toString();
      console.log(`Current balance: ${currentBalance} raw, new balance will be: ${newBalance} raw`);
      
      // Generate work for the send transaction
      console.log(`Generating work using previous block: ${accountInfo.frontier}`);
      const work = await this.generateWork(accountInfo.frontier);
      
      // Get destination public key
      const destinationPublicKey = nanocurrencyWeb.tools.addressToPublicKey(toAddress);
      
      // Create the block
      const representative = accountInfo.representative || 'nano_3rropjiqfxpmrrkooej4qtmm1pueu36f9ghinpho4esfdor8785a455d16nf';
      
      const block: BlockData = {
        type: 'state',
        account: fromAddress,
        previous: accountInfo.frontier,
        representative: representative,
        balance: newBalance,
        link: destinationPublicKey,
        work: work
      };
      
      // Create block hash
      const blockForHash = {
        account: block.account,
        previous: block.previous,
        representative: block.representative,
        balance: block.balance,
        link: block.link
      };
      
      const blockHash = nanocurrency.hashBlock(blockForHash);
      
      // Sign the block
      block.signature = nanocurrency.signBlock({
        hash: blockHash,
        secretKey: normalizedKey
      });
      
      console.log(`Created signed send block with hash: ${blockHash}`);
      
      // Process the block using different methods
      let result = await this.processBlockStandard(block);
      
      // If standard method fails, try fallback methods
      if (result.error) {
        console.log(`Standard block processing failed: ${result.error}, trying alternatives...`);
        
        // Try the force method
        result = await this.processBlockForce(block);
        
        if (result.error) {
          // Try the direct send RPC method
          console.log(`Force method failed: ${result.error}, trying direct send...`);
          const directResult = await this.sendDirect(fromAddress, toAddress, rawAmount);
          
          if (directResult.error) {
            return { 
              success: false, 
              error: `All send methods failed. Last error: ${directResult.error}`,
              block: block
            };
          }
          
          return { success: true, hash: directResult.hash, block: block };
        }
      }
      
      return { success: true, hash: result.hash || blockHash, block: block };
    } catch (error) {
      console.error('Error in send transaction:', error);
      return { success: false, error: `Unexpected error in send transaction: ${error}` };
    }
  }
  
  /**
   * Get account information
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
          representative: true,
          pending: true
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching account info:', error);
      return { error: 'Failed to fetch account info' };
    }
  }
  
  /**
   * Generate work for a block 
   */
  private async generateWork(hash: string): Promise<string> {
    try {
      console.log(`Generating work for hash: ${hash}`);
      
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
          difficulty: 'fffffff800000000'
        })
      });
      
      const data = await response.json() as any;
      
      if (data.error) {
        throw new Error(`Work generation failed: ${data.error}`);
      }
      
      console.log(`Generated work: ${data.work}`);
      return data.work;
    } catch (error) {
      console.error('Error generating work:', error);
      
      // Fallback to a simpler work generation if the main one fails
      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'work_generate',
            hash: hash
          })
        });
        
        const data = await response.json() as any;
        
        if (data.error) {
          throw new Error(`Fallback work generation failed: ${data.error}`);
        }
        
        console.log(`Generated fallback work: ${data.work}`);
        return data.work;
      } catch (fallbackError) {
        console.error('Fallback work generation failed:', fallbackError);
        throw new Error('All work generation methods failed');
      }
    }
  }
  
  /**
   * Process a block with standard method
   */
  private async processBlockStandard(block: BlockData): Promise<{ hash?: string, error?: string }> {
    try {
      console.log('Processing block with standard method...');
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'process',
          json_block: 'true',
          block: block
        })
      });
      
      const data = await response.json() as any;
      
      if (data.error) {
        return { error: data.error };
      }
      
      if (data.hash) {
        console.log(`Block processed successfully with hash: ${data.hash}`);
        return { hash: data.hash };
      }
      
      return { error: 'Unknown error in process block' };
    } catch (error) {
      console.error('Error in process block:', error);
      return { error: 'Failed to process block' };
    }
  }
  
  /**
   * Process a block with force parameter
   */
  private async processBlockForce(block: BlockData): Promise<{ hash?: string, error?: string }> {
    try {
      console.log('Processing block with force parameter...');
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'process',
          json_block: 'true',
          block: block,
          force: 'true',
          subtype: 'send'
        })
      });
      
      const data = await response.json() as any;
      
      if (data.error) {
        return { error: data.error };
      }
      
      if (data.hash) {
        console.log(`Block processed successfully with force and hash: ${data.hash}`);
        return { hash: data.hash };
      }
      
      return { error: 'Unknown error in force process block' };
    } catch (error) {
      console.error('Error in force process block:', error);
      return { error: 'Failed to process block with force' };
    }
  }
  
  /**
   * Use direct send RPC method
   */
  private async sendDirect(fromAddress: string, toAddress: string, amount: string): Promise<{ hash?: string, error?: string }> {
    try {
      console.log(`Trying direct send from ${fromAddress} to ${toAddress} for ${amount} raw`);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey
        },
        body: JSON.stringify({
          action: 'send',
          source: fromAddress,
          destination: toAddress,
          amount: amount
        })
      });
      
      const data = await response.json() as any;
      
      if (data.error) {
        return { error: data.error };
      }
      
      if (data.block) {
        console.log(`Direct send successful with block: ${data.block}`);
        return { hash: data.block };
      }
      
      return { error: 'Unknown error in direct send' };
    } catch (error) {
      console.error('Error in direct send:', error);
      return { error: 'Failed to execute direct send' };
    }
  }
  
  /**
   * Convert XNO amount to raw units
   */
  private convertToRaw(amount: string): string {
    // Parse the amount as a number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      console.log('Invalid amount format');
      return '0';
    }
    
    // Convert to raw (1 XNO = 10^30 raw)
    const rawAmount = BigInt(Math.floor(numAmount * 1e6)) * BigInt(1e24);
    return rawAmount.toString();
  }
}

export const sendXnoService = new SendXnoService();