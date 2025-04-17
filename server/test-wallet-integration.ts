import fetch from 'node-fetch';

// Sample XNO wallet address for testing (from Nano explorer examples)
const validWallet = 'nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkztrfjy5k7z4imsrata9est';
const invalidWallet = 'invalid_wallet_address';

async function testWalletAPI() {
  console.log('\n=== Testing Wallet API Integration ===\n');
  
  // Test valid wallet verification via API
  console.log('Testing valid wallet verification via API endpoint');
  try {
    const response = await fetch('http://localhost:5000/api/wallet/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address: validWallet })
    });
    
    const result = await response.json();
    console.log('Valid wallet verification result:', result);
  } catch (error) {
    console.error('Error during API wallet verification:', error);
  }
  
  // Test invalid wallet verification via API
  console.log('\n--- Testing invalid wallet verification via API ---');
  try {
    const response = await fetch('http://localhost:5000/api/wallet/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address: invalidWallet })
    });
    
    const result = await response.json();
    console.log('Invalid wallet verification result:', result);
  } catch (error) {
    console.error('Error during invalid wallet verification:', error);
  }
  
  // Test wallet balance retrieval via API
  console.log('\n--- Testing wallet balance retrieval via API ---');
  try {
    const response = await fetch('http://localhost:5000/api/wallet/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address: validWallet })
    });
    
    const result = await response.json();
    console.log('Wallet balance result:', result);
  } catch (error) {
    console.error('Error during wallet balance retrieval:', error);
  }
  
  console.log('\n=== Wallet API Integration Test Complete ===\n');
}

// Run the test
testWalletAPI().catch(console.error);