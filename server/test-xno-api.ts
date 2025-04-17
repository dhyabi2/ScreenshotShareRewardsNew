import { xnoService } from './utils/xnoService';

// Sample XNO wallet address for testing (from Nano explorer examples)
const testWalletAddress = 'nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkztrfjy5k7z4imsrata9est';

async function testXNOAPI() {
  console.log('\n=== Testing XNO Blockchain API Integration ===\n');
  
  // Test wallet verification
  console.log('Testing wallet verification for address:', testWalletAddress);
  try {
    const walletInfo = await xnoService.verifyWallet(testWalletAddress);
    console.log('Wallet verification result:');
    console.log('- Valid:', walletInfo.valid);
    console.log('- Balance:', walletInfo.balance, 'XNO');
    console.log('- Address:', walletInfo.address);
  } catch (error) {
    console.error('Error during wallet verification:', error);
  }
  
  console.log('\n--- Testing with invalid wallet address ---');
  try {
    const invalidWallet = 'invalid_wallet_address';
    const invalidWalletInfo = await xnoService.verifyWallet(invalidWallet);
    console.log('Invalid wallet verification result:');
    console.log('- Valid:', invalidWalletInfo.valid);
    console.log('- Balance:', invalidWalletInfo.balance, 'XNO');
  } catch (error) {
    console.error('Error during invalid wallet verification:', error);
  }
  
  // Test random wallet balance simulation when address is valid but account doesn't exist
  console.log('\n--- Testing with valid format but non-existent account ---');
  try {
    // This is a valid format but likely doesn't exist
    const nonExistentWallet = 'nano_3test9test9test9test9test9test9test9test9test9test9testnoext';
    const nonExistentWalletInfo = await xnoService.verifyWallet(nonExistentWallet);
    console.log('Non-existent wallet verification result:');
    console.log('- Valid:', nonExistentWalletInfo.valid);
    console.log('- Balance:', nonExistentWalletInfo.balance, 'XNO');
  } catch (error) {
    console.error('Error during non-existent wallet verification:', error);
  }
  
  console.log('\n=== XNO API Test Complete ===\n');
}

// Run the test
testXNOAPI().catch(console.error);