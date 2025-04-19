/**
 * XNO Pool Wallet Generator
 * This script creates a new XNO wallet to use as the community reward pool
 */

const nanocurrency = require('nanocurrency');
const fetch = require('node-fetch');

// RPC API endpoint
const RPC_API = 'https://rpc.nano.to';
const RPC_KEY = process.env.RPC_KEY || '';

/**
 * Generate a new pool wallet with all necessary details
 */
async function generatePoolWallet() {
  try {
    console.log('Generating new XNO pool wallet...');
    
    // Create a random seed
    const seed = nanocurrency.generateSeed();
    console.log(`\nSeed: ${seed}`);
    
    // Derive account 0 from the seed
    const privateKey = nanocurrency.deriveSecretKey(seed, 0);
    console.log(`Private Key: ${privateKey}`);
    
    // Get the public address
    const publicKey = nanocurrency.derivePublicKey(privateKey);
    const publicAddress = nanocurrency.deriveAddress(publicKey);
    console.log(`Public Address: ${publicAddress}`);
    
    // Output instructions for saving as Replit secrets
    console.log('\n============================================================');
    console.log('IMPORTANT: Save these values as Replit Secrets');
    console.log('============================================================');
    console.log('1. Add the "POOL_WALLET_ADDRESS" secret with value:');
    console.log(publicAddress);
    console.log('\n2. Add the "POOL_WALLET_PRIVATE_KEY" secret with value:');
    console.log(privateKey);
    console.log('\n3. (Optional) Add the "POOL_WALLET_SEED" secret with value:');
    console.log(seed);
    console.log('============================================================');
    
    // Check if we can connect to the Nano network
    console.log('\nVerifying connection to Nano network...');
    
    try {
      const response = await fetch(RPC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(RPC_KEY ? { 'Authorization': RPC_KEY } : {})
        },
        body: JSON.stringify({
          action: 'account_info',
          account: publicAddress
        })
      });
      
      const data = await response.json();
      
      if (data.error === 'Account not found') {
        console.log('✓ Successfully connected to Nano network');
        console.log('✓ This is a new account with 0 balance');
        console.log('\nNext Steps:');
        console.log('1. Fund this wallet with 10 XNO to initialize the reward pool');
        console.log('2. Restart the application after adding the secrets');
      } else if (data.balance) {
        const balance = parseInt(data.balance) / 1e30;
        console.log(`✓ Account exists with ${balance} XNO balance`);
      } else {
        console.log('Warning: Unexpected response from Nano network');
        console.log(data);
      }
    } catch (error) {
      console.error('Error connecting to Nano network:', error.message);
      console.log('\nDespite the connection error, the wallet was generated successfully.');
    }
    
    return {
      seed,
      privateKey,
      publicAddress
    };
  } catch (error) {
    console.error('Error generating wallet:', error);
    process.exit(1);
  }
}

// Execute only if run directly
if (require.main === module) {
  generatePoolWallet();
}

module.exports = { generatePoolWallet };