import { generateWallet } from 'nanocurrency-web';

// Generate a new wallet
const wallet = generateWallet();
console.log(JSON.stringify(wallet, null, 2));