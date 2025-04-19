/**
 * Pool Wallet Generator
 * This utility creates a new XNO wallet to be used as the platform's pool wallet
 * The address and private key should be saved as Replit secrets
 */

import { tools } from 'nanocurrency-web';
import { nanoTransactions } from './nanoTransactions';
import { log } from '../vite';

/**
 * Generate a new secure Nano wallet for the pool
 */
async function generatePoolWallet() {
  try {
    // Generate a new random seed (64 hex characters)
    const seed = tools.createSeed();
    
    // Derive index 0 account from seed
    const privateKey = tools.seedToPrivateKey(seed, 0);
    const publicAddress = tools.privateKeyToAddress(privateKey);
    
    // Output wallet details (in a real scenario, these would be saved securely)
    console.log('\n====== POOL WALLET DETAILS ======');
    console.log(`Seed (keep this secure!): ${seed}`);
    console.log(`Private Key: ${privateKey}`);
    console.log(`Public Address: ${publicAddress}`);
    console.log('==================================\n');
    
    console.log('Add these values to your Replit secrets:');
    console.log('1. POOL_WALLET_ADDRESS = ' + publicAddress);
    console.log('2. POOL_WALLET_PRIVATE_KEY = ' + privateKey);
    console.log('3. POOL_WALLET_SEED = ' + seed + ' (optional, for recovery)');
    
    // Validate the wallet
    console.log('\nValidating wallet...');
    try {
      const info = await nanoTransactions.getAccountInfo(publicAddress);
      if (info && !info.error) {
        console.log('Wallet already exists on the network!');
        console.log(`Balance: ${parseFloat(info.balance) / 1e30} XNO`);
      } else {
        console.log('This is a new wallet with 0 balance.');
        console.log('You need to fund this wallet with 10 XNO to initialize the reward pool.');
      }
    } catch (error) {
      console.log('This is a new wallet with 0 balance.');
      console.log('You need to fund this wallet with 10 XNO to initialize the reward pool.');
    }
    
    return {
      seed,
      privateKey,
      publicAddress
    };
  } catch (error) {
    console.error('Error generating pool wallet:', error);
    throw error;
  }
}

// Run the generator if this script is executed directly
if (require.main === module) {
  generatePoolWallet()
    .then(() => {
      console.log('\nPool wallet generated successfully!');
      console.log('Important: Save these details securely. They cannot be recovered if lost.');
    })
    .catch(err => {
      console.error('Failed to generate pool wallet:', err);
      process.exit(1);
    });
}

export { generatePoolWallet };