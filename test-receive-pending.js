import fetch from 'node-fetch';

async function receivePendingTransactions() {
  try {
    console.log('Attempting to receive pending transactions...');
    
    // Replace with your actual wallet address and private key
    const address = 'nano_1741g9aff1abwix3cosopqd6r3kd3zin9cozpqjibjsc6qj17zckkbby1acc';
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000000'; // You'll need to provide a real private key
    
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
      
      // Call the receive endpoint
      const receiveResponse = await fetch('http://localhost:5000/api/wallet/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address, 
          privateKey 
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