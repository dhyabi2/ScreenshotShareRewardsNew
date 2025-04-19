/**
 * Nano client-side transaction helper
 * This utility enables client-side block creation and signing for XNO transactions
 * Since we're limited by the RPC endpoint capabilities, this gives us more control
 */

import { isValidXNOAddress } from '../helpers/validators';
import * as nanocurrency from 'nanocurrency';
import * as nanocurrencyWeb from 'nanocurrency-web';
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
   * Generate work for a block hash - tries multiple methods
   * @param hash - The hash to generate work for
   * @param isOpenBlock - Set to true for special handling of opening blocks which have different work requirements
   */
  async generateWork(hash: string, isOpenBlock = false): Promise<string> {
    try {
      // Opening blocks have different difficulty requirements in some node versions
      // Try with multiple work generation services to ensure compatibility
      const services = [
        {
          name: "Primary RPC",
          url: this.apiUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.rpcKey,
            'X-GPU-Key': this.gpuKey
          },
          body: {
            action: 'work_generate',
            hash: hash,
            // For opening blocks, use a different difficulty that meets threshold
            difficulty: isOpenBlock ? 'fffffff800000000' : 'fffffff800000000'
          }
        },
        {
          name: "Fallback RPC with default difficulty",
          url: this.apiUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.rpcKey,
            'X-GPU-Key': this.gpuKey
          },
          body: {
            action: 'work_generate',
            hash: hash,
            use_peers: 'true'
          }
        },
        {
          name: "Fallback RPC (lower difficulty)",
          url: this.apiUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.rpcKey,
            'X-GPU-Key': this.gpuKey
          },
          body: {
            action: 'work_generate',
            hash: hash,
            // Set an even lower difficulty for fallback
            difficulty: isOpenBlock ? 'ff00000000000000' : 'fffffe0000000000'
          }
        },
        {
          name: "Public node",
          url: 'https://proxy.nanos.cc/proxy/', 
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            action: 'work_generate',
            hash: hash,
            difficulty: 'fffffe0000000000' // Lower difficulty
          }
        },
        {
          name: "Alternative public node",
          url: 'https://node.nanocrawler.cc/proxy',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            action: 'work_generate',
            hash: hash
          }
        }
      ];
      
      // Try each service in order until one succeeds
      let lastError = '';
      for (const service of services) {
        console.log(`Trying work generation with ${service.name}...`);
        try {
          const response = await fetch(service.url, {
            method: 'POST',
            headers: service.headers,
            body: JSON.stringify(service.body)
          });
          
          const data = await response.json() as any;
          
          if (!data.error && data.work) {
            console.log(`Work generation successful with ${service.name}`);
            return data.work;
          }
          
          lastError = data.error || 'Unknown error';
          console.log(`Work generation failed with ${service.name}: ${lastError}`);
        } catch (err) {
          console.log(`Error with ${service.name}: ${err}`);
        }
      }
      
      // If we get here, all services failed
      throw new Error(`All work generation attempts failed. Last error: ${lastError}`);
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
   * Process a block through the node - tries multiple methods
   * @param block - The block to process
   * @param isOpeningBlock - Set to true for opening blocks (affects work threshold)
   */
  async processBlock(block: BlockData, isOpeningBlock = false): Promise<{ hash?: string; error?: string }> {
    try {
      // Determine the subtype based on the block structure
      const subtype = block.previous === '0000000000000000000000000000000000000000000000000000000000000000' 
        ? 'open' // Opening block for new account
        : (block.link && block.link.length === 64) 
          ? 'receive' // Receive block
          : 'send'; // Send block
      
      // Retry with progressively more permissive approaches
      const attempts = [
        // Attempt 1: Standard process with json_block
        {
          name: "Standard process",
          body: {
            action: 'process',
            json_block: 'true',
            block: block
          }
        },
        // Attempt 2: With subtype specified
        {
          name: "Subtype process",
          body: {
            action: 'process',
            json_block: 'true',
            subtype: subtype,
            block: block
          }
        },
        // Attempt 3: With force flag
        {
          name: "Force process",
          body: {
            action: 'process',
            json_block: 'true',
            subtype: subtype,
            force: 'true',
            do_work: false,
            block: block
          }
        },
        // Attempt 4: With different work thresholds for different operations
        {
          name: "Adjusted work threshold process",
          body: {
            action: 'process',
            json_block: 'true',
            subtype: subtype,
            force: 'true',
            threshold: isOpeningBlock ? 'ff00000000000000' : 'fffffe0000000000',
            block: block
          }
        }
      ];
      
      let lastError = '';
      
      // Try each method until one works
      for (const attempt of attempts) {
        console.log(`Attempting block processing with: ${attempt.name}...`);
        
        try {
          const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': this.rpcKey,
              'X-GPU-Key': this.gpuKey
            },
            body: JSON.stringify(attempt.body)
          });
  
          const data = await response.json() as any;
          
          // If successful, return the hash
          if (!data.error && data.hash) {
            console.log(`Success with ${attempt.name}`);
            return { hash: data.hash };
          }
          
          lastError = data.error || 'Unknown error';
          console.log(`${attempt.name} failed: ${lastError}`);
        } catch (err) {
          console.error(`Error with ${attempt.name}:`, err);
        }
      }
      
      // If all primary methods fail, try with public nodes
      const publicNodes = [
        {
          name: "Public node 1",
          url: 'https://proxy.nanos.cc/proxy/',
          body: {
            action: 'process',
            json_block: 'true',
            subtype: subtype,
            force: 'true',
            block: block
          }
        },
        {
          name: "Public node 2",
          url: 'https://node.nanocrawler.cc/proxy',
          body: {
            action: 'process',
            json_block: 'true',
            subtype: subtype,
            block: block
          }
        }
      ];
      
      // Try each public node
      for (const publicNode of publicNodes) {
        console.log(`Trying ${publicNode.name} for block processing...`);
        try {
          const publicNodeResponse = await fetch(publicNode.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(publicNode.body)
          });
          
          // Check if the response is valid JSON
          const text = await publicNodeResponse.text();
          try {
            const publicNodeData = JSON.parse(text);
            
            if (!publicNodeData.error && publicNodeData.hash) {
              console.log(`Success with ${publicNode.name}`);
              return { hash: publicNodeData.hash };
            }
            
            console.log(`${publicNode.name} failed: ${publicNodeData.error || 'Unknown error'}`);
          } catch (jsonError) {
            console.log(`Failed to parse ${publicNode.name} response:`, text);
          }
        } catch (networkError) {
          console.log(`${publicNode.name} request failed:`, networkError);
        }
      }
      
      // If all methods fail, return a generic error with the last error we encountered
      console.error('All block processing methods failed');
      return { error: lastError || 'Block processing failed' };
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
      const work = await this.generateWork(publicKey, true); // Pass true to indicate this is an opening block
      
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
      
      // Process the block - specify this is an opening block for appropriate work threshold
      const processResult = await this.processBlock(block, true);
      
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
      // Use nanocurrency-web library to properly convert address to public key
      const publicKey = nanocurrencyWeb.tools.addressToPublicKey(toAddress);
      
      // Create a state block
      const block: BlockData = {
        type: 'state',
        account: fromAddress,
        previous: accountInfo.frontier,
        representative: representative,
        balance: newBalance,
        link: publicKey,
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
          amountStr = (amount as any).amount ? (amount as any).amount.toString() : '0';
        } else {
          // Others return the value directly
          amountStr = amount?.toString() || '0';
        }
        console.log(`Processing block ${blockHash} with amount ${amountStr} for ${address}`);
        
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