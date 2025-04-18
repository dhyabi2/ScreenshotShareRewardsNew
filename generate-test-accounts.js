// This script generates a test account and sends a small amount of nano to itself for testing
const nanocurrency = require('nanocurrency');
const nanocurrencyWeb = require('nanocurrency-web');
const fetch = require('node-fetch');

const RPC_API = 'https://rpc.nano.to/';
const RPC_KEY = process.env.RPC_KEY || '';
const GPU_KEY = process.env.GPU_KEY || '';

// Generate a new account
function generateAccount() {
  // Create a seed
  const seed = nanocurrency.generateSeed();
  console.log('Generated seed:', seed);
  
  // Derive a private key
  const privateKey = nanocurrency.deriveSecretKey(seed, 0);
  console.log('Private key:', privateKey);
  
  // Derive a public key
  const publicKey = nanocurrency.derivePublicKey(privateKey);
  console.log('Public key:', publicKey);
  
  // Generate an address
  const address = nanocurrency.deriveAddress(publicKey);
  console.log('Address:', address);
  
  return { seed, privateKey, publicKey, address };
}

// Main function
async function main() {
  try {
    const { seed, privateKey, publicKey, address } = generateAccount();
    
    // Output these important values
    console.log('\nIMPORTANT - SAVE THESE VALUES:');
    console.log('Wallet address:', address);
    console.log('Private key:', privateKey);
    
    // Generate a QR code URL for this address
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${address}&format=png`;
    console.log('QR code URL:', qrCodeUrl);
    
    // Check if there's already a balance
    const accountInfo = await fetchAccountInfo(address);
    if (!accountInfo.error) {
      console.log('\nAccount balance:', accountInfo.balance / 10**30, 'XNO');
    } else {
      console.log('\nAccount not found in the ledger yet (no transactions)');
    }
    
    console.log('\nUse these credentials in the application to test XNO transactions.');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Helper function to fetch account info
async function fetchAccountInfo(address) {
  try {
    const response = await fetch(RPC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': RPC_KEY,
        'X-GPU-Key': GPU_KEY
      },
      body: JSON.stringify({
        action: 'account_info',
        account: address,
        representative: true
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get account info:', error);
    return { error: 'API request failed' };
  }
}

// Run the main function
main().catch(console.error);