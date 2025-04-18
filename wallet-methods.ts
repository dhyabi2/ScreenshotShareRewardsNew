  /**
   * Get detailed account information directly from RPC
   */
  async getAccountDetails(address: string): Promise<any> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey,
          'X-GPU-Key': 'RPC-KEY-BAB822FCCDAE42ECB7A331CCAAAA23'
        },
        body: JSON.stringify({
          action: 'account_info',
          account: address,
          representative: true,
          pending: true,
          weight: true,
          include_confirmed: true
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting account details:', error);
      return { error: 'Failed to get account details' };
    }
  }
  
  /**
   * Get pending transactions with options for detail level
   */
  async getPendingTransactions(address: string, includeDetails = false): Promise<any> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.rpcKey,
          'X-GPU-Key': 'RPC-KEY-BAB822FCCDAE42ECB7A331CCAAAA23'
        },
        body: JSON.stringify({
          action: 'pending',
          account: address,
          count: 10,
          source: true,
          include_only_confirmed: true
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching pending transactions:', data.error);
        return { count: 0, blocks: [] };
      }
      
      const pendingBlocks = Object.keys(data.blocks || {});
      
      if (includeDetails) {
        // Format the response with more details
        const formattedBlocks = pendingBlocks.map(blockHash => {
          let amount, source;
          
          if (typeof data.blocks[blockHash] === 'object') {
            amount = data.blocks[blockHash].amount;
            source = data.blocks[blockHash].source;
          } else {
            amount = data.blocks[blockHash];
            source = null;
          }
          
          // Convert raw amount to NANO
          const nanoAmount = this.rawToXno(amount);
          
          return {
            hash: blockHash,
            amount: amount,
            amountNano: parseFloat(nanoAmount),
            source: source
          };
        });
        
        return {
          count: pendingBlocks.length,
          blocks: formattedBlocks
        };
      } else {
        // Simple response
        return {
          count: pendingBlocks.length,
          blocks: pendingBlocks
        };
      }
    } catch (error) {
      console.error('Error getting pending transactions:', error);
      return { count: 0, blocks: [] };
    }
  }
  
  /**
   * Receive pending transactions with custom options
   */
  async receivePendingWithOptions(
    address: string, 
    privateKey: string, 
    options: ReceiveOptions = {}
  ): Promise<{
    received: boolean;
    count: number;
    totalAmount: number;
    processedBlocks?: Array<ProcessedBlock>;
  }> {
    if (!privateKey) {
      console.warn('WARNING: No private key provided for receiving pending transactions');
      return { 
        received: false, 
        count: 0, 
        totalAmount: 0
      };
    }

    try {
      console.log(`Attempting to receive pending funds with custom options for wallet: ${address}`);
      const pendingInfo = await this.getPendingBlocks(address);
      
      if (!pendingInfo.blocks || Object.keys(pendingInfo.blocks).length === 0) {
        console.log('No pending blocks to receive');
        return { received: false, count: 0, totalAmount: 0 };
      }
      
      // Get account info to check if this is a new account
      const accountInfo = await this.getAccountInfo(address);
      const isNewAccount = !accountInfo || accountInfo.error === 'Account not found' || !accountInfo.frontier;
      
      // Process each pending block with custom options
      const pendingBlocks = Object.keys(pendingInfo.blocks);
      let receivedCount = 0;
      let totalAmount = BigInt(0);
      const processedBlocks: ProcessedBlock[] = [];
      const maxRetries = options.maxRetries || 3;
      const customThreshold = options.workThreshold || (isNewAccount ? 'ff00000000000000' : 'ffff000000000000');
      
      // Import nanoTransactions for client-side processing
      const { nanoTransactions } = await import('./nanoTransactions');
      
      for (const blockHash of pendingBlocks) {
        try {
          // Get the amount for this block
          let amountStr = '';
          if (typeof pendingInfo.blocks[blockHash] === 'object') {
            amountStr = pendingInfo.blocks[blockHash].amount.toString();
          } else {
            amountStr = pendingInfo.blocks[blockHash].toString();
          }
          
          console.log(`Processing block ${blockHash} with custom options (threshold: ${customThreshold})`);
          
          let result;
          let retrySuccess = false;
          
          for (let i = 0; i < maxRetries; i++) {
            console.log(`Attempt ${i + 1} of ${maxRetries}`);
            
            try {
              if (isNewAccount && receivedCount === 0) {
                // For opening blocks, use special method
                result = await nanoTransactions.createOpenBlock(
                  address, 
                  privateKey, 
                  blockHash, 
                  amountStr
                );
              } else {
                // For subsequent blocks on a new account or existing accounts
                const freshAccountInfo = await this.getAccountInfo(address);
                if (freshAccountInfo.error) {
                  console.log(`Error getting account info for subsequent block: ${freshAccountInfo.error}`);
                  continue;
                }
                
                result = await nanoTransactions.createReceiveBlock(
                  address, 
                  privateKey, 
                  blockHash, 
                  amountStr, 
                  freshAccountInfo
                );
              }
              
              if (result.success) {
                retrySuccess = true;
                break;
              }
            } catch (attemptError) {
              console.error(`Error in attempt ${i + 1}:`, attemptError);
              // Continue to next attempt
            }
          }
          
          if (retrySuccess) {
            receivedCount++;
            totalAmount = totalAmount + BigInt(amountStr);
            processedBlocks.push({
              blockHash,
              amount: amountStr,
              success: true,
              resultHash: result.hash
            });
          } else {
            processedBlocks.push({
              blockHash,
              amount: amountStr,
              success: false,
              error: result?.error || 'Failed after multiple attempts'
            });
          }
        } catch (blockError) {
          console.error(`Error processing block ${blockHash}:`, blockError);
          processedBlocks.push({
            blockHash,
            success: false,
            amount: '0',
            error: blockError instanceof Error ? blockError.message : 'Unknown error'
          });
        }
      }
      
      return {
        received: receivedCount > 0,
        count: receivedCount,
        totalAmount: receivedCount > 0 ? 
          parseFloat(this.rawToXno(totalAmount.toString())) : 0,
        processedBlocks
      };
    } catch (error) {
      console.error('Error in receivePendingWithOptions:', error);
      return {
        received: false,
        count: 0,
        totalAmount: 0,
        processedBlocks: [{
          blockHash: 'error',
          amount: '0',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }