/**
 * Generate Pool Wallet Keys
 * 
 * This script creates a new XNO wallet that can be used as the platform's pool wallet.
 * It will output the wallet address and private key that need to be added to Replit secrets.
 * It also saves the keys to a backup file for future reference.
 */

import * as nanocurrency from 'nanocurrency-web';
import * as fs from 'fs';

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
    console.log(`   - Name: PUBLIC_POOL_ADDRESS, Value: ${account.address}`);
    console.log(`   - Name: POOL_PRIVATE_KEY, Value: ${account.privateKey}`);
    console.log('\nIMPORTANT: Save these details securely elsewhere. They cannot be recovered if lost!\n');
    
    // Save backup to a file
    const backupData = {
      seed: wallet.seed,
      privateKey: account.privateKey,
      address: account.address,
      generated: new Date().toISOString()
    };
    
    // Save backup file
    const backupFilename = `pool-wallet-backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
    fs.writeFileSync(backupFilename, JSON.stringify(backupData, null, 2));
    console.log(`Backup saved to ${backupFilename}`);
    
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