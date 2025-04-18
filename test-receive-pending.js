import fetch from 'node-fetch';
import pkg from 'nanocurrency-web';
const { wallet } = pkg;

async function receivePendingTransactions() {
  try {
    console.log('Attempting to receive pending transactions...');
    
    // Get the address from the command line arguments or use the default
    const address = process.argv[2] || 'nano_1741g9aff1abwix3cosopqd6r3kd3zin9cozpqjibjsc6qj17zckkbby1acc';
    
    // For testing, you can use this test wallet we generated:
    // Address: nano_3fqywgx53t971be4wyzsejme4dmq6yoj99k5bw7adp9rnkrr9gzs56sqib7b
    // Private Key: 0854c5648430d64171b32a0aa1b1da76d88dd3d2f36231f8a18aa6077e721d67
    
    // For testing only - generate a new wallet if needed
    // In production, the user should provide their own private key
    let privateKey = process.argv[3]; // Get private key from command line arg
    
    if (!privateKey) {
      console.log('WARNING: No private key provided! Generating test wallet for this address...');
      try {
        // Generate a new wallet for testing (this won't have the same private key as our address)
        const newWallet = wallet.generate();
        privateKey = newWallet.accounts[0].privateKey;
        const testAddress = newWallet.accounts[0].address;
        console.log(`Generated test wallet address: ${testAddress}`);
        console.log(`Generated test private key: ${privateKey}`);
        console.log(`This is ONLY for testing and won't be able to access the real wallet!`);
      } catch (err) {
        // If we can't generate a wallet, use a placeholder
        console.log('Failed to generate wallet, using placeholder key');
        privateKey = '0854c5648430d64171b32a0aa1b1da76d88dd3d2f36231f8a18aa6077e721d67';
      }
    }
    
    // First check wallet info to see pending blocks
    const infoResponse = await fetch('http://localhost:5000/api/wallet/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    const walletInfo = await infoResponse.json();
    console.log('Wallet info before receiving:', JSON.stringify(walletInfo, null, 2));
    
    // Check if there are any pending blocks
    if (walletInfo.pending && walletInfo.pending.blocks && walletInfo.pending.blocks.length > 0) {
      console.log(`Found ${walletInfo.pending.blocks.length} pending blocks to receive!`);
      
      // Call the receive endpoint in debug mode to get more details
      const receiveResponse = await fetch('http://localhost:5000/api/wallet/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address, 
          privateKey,
          debug: true  // Add debug flag to get more information
        })
      });
      
      const receiveResult = await receiveResponse.json();
      console.log('Receive result:', JSON.stringify(receiveResult, null, 2));
      
      // Check wallet info again after receive operation
      const afterInfoResponse = await fetch('http://localhost:5000/api/wallet/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const afterWalletInfo = await afterInfoResponse.json();
      console.log('Wallet info after receiving:', JSON.stringify(afterWalletInfo, null, 2));
    } else {
      console.log('No pending blocks found to receive.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

receivePendingTransactions();