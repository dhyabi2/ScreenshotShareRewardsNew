/**
 * Generate Pool Wallet Keys
 * 
 * This script creates a new XNO wallet that can be used as the platform's pool wallet.
 * It will output the wallet address and private key that need to be added to Replit secrets.
 */

import * as nanocurrency from 'nanocurrency-web';

/**
 * Generate a new secure Nano wallet
 */
async function generatePoolWallet() {
  try {
    console.log('Generating new wallet using nanocurrency-web...');
    
    // Generate a wallet with random seed - Use the wallet.generate() method
    const wallet = nanocurrency.wallet.generate();
    
    // Get the first account from the wallet
    const account = wallet.accounts[0];
    
    // Extract wallet details
    console.log('\n====== POOL WALLET DETAILS ======');
    console.log(`Seed: ${wallet.seed}`);
    console.log(`Private Key: ${account.privateKey}`);
    console.log(`Public Address: ${account.address}`);
    console.log('==================================\n');
    
    console.log('To use this wallet as your pool wallet:');
    console.log('1. Go to Replit Secrets (lock icon in sidebar)');
    console.log('2. Add these secrets:');
    console.log(`   - Name: PUBLIC_KEY, Value: ${account.address}`);
    console.log(`   - Name: RPC_KEY, Value: ${account.privateKey}`);
    console.log('\nIMPORTANT: Save these details securely elsewhere. They cannot be recovered if lost!\n');
    
    return {
      seed: wallet.seed,
      privateKey: account.privateKey,
      address: account.address
    };
  } catch (error) {
    console.error('Error generating pool wallet:', error);
    throw error;
  }
}

// Run the generator
generatePoolWallet();