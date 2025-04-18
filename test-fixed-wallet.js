import fetch from 'node-fetch';

// Use a known address with pending funds for testing
// These accounts already exist on the network and have pending transactions

// Example 1: Account with a pending transaction
const address = 'nano_1741g9aff1abwix3cosopqd6r3kd3zin9cozpqjibjsc6qj17zckkbby1acc';
// This is a test private key - replace with the real private key if you own this wallet
const privateKey = 'BC1E5F0997DD69B878110F1B6513D8B0FD29F59BD9E79E33CE017F4B35D6BD66';

async function testReceiveWithWalletService() {
  try {
    console.log(`Testing receive with direct wallet service call for ${address}`);
    
    // First get wallet info to see pending blocks
    const infoResponse = await fetch('http://localhost:5000/api/wallet/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    const walletInfo = await infoResponse.json();
    console.log('Wallet info:', JSON.stringify(walletInfo, null, 2));
    
    // Get account details directly from RPC
    const accountDetailsResponse = await fetch('http://localhost:5000/api/wallet/account-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    const accountDetails = await accountDetailsResponse.json();
    console.log('Account details:', JSON.stringify(accountDetails, null, 2));
    
    // Get pending transactions
    const pendingResponse = await fetch('http://localhost:5000/api/wallet/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address,
        includeDetails: true
      })
    });
    
    const pendingTransactions = await pendingResponse.json();
    console.log('Pending transactions:', JSON.stringify(pendingTransactions, null, 2));
    
    // Try to receive with very low work threshold
    const receiveResponse = await fetch('http://localhost:5000/api/wallet/receive-with-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address,
        privateKey,
        workThreshold: 'ff00000000000000', // Very low threshold for testing
        retryCount: 5, // Try up to 5 times
        debug: true
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
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testReceiveWithWalletService();