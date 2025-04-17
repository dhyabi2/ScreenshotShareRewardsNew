import { xnoService } from './utils/xnoService';

// Sample XNO wallet addresses for testing (from Nano explorer examples)
const senderWallet = 'nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkztrfjy5k7z4imsrata9est';
const receiverWallet = 'nano_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k';

async function testPaymentVerification() {
  console.log('\n=== Testing XNO Payment Verification ===\n');
  
  // Test payment verification with small amount
  const smallAmount = 0.001; // 0.001 XNO
  console.log(`Testing payment verification from ${senderWallet} to ${receiverWallet} for ${smallAmount} XNO`);
  
  try {
    const paymentVerified = await xnoService.checkPayment(senderWallet, receiverWallet, smallAmount);
    console.log('Payment verification result:', paymentVerified ? 'VERIFIED' : 'NOT VERIFIED');
    
    // Check sender balance
    const senderInfo = await xnoService.verifyWallet(senderWallet);
    console.log(`Sender balance: ${senderInfo.balance} XNO`);
    console.log(`Sender has sufficient balance for payment: ${senderInfo.balance >= smallAmount}`);
  } catch (error) {
    console.error('Error during payment verification:', error);
  }
  
  // Test with invalid wallet addresses
  console.log('\n--- Testing with invalid wallet address ---');
  try {
    const invalidResult = await xnoService.checkPayment('invalid_wallet', receiverWallet, smallAmount);
    console.log('Invalid wallet payment verification result:', invalidResult);
  } catch (error) {
    console.error('Error during invalid wallet payment verification:', error);
  }
  
  console.log('\n=== Payment Verification Test Complete ===\n');
}

// Run the test
testPaymentVerification().catch(console.error);