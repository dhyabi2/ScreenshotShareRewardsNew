import pkg from 'nanocurrency-web';
const { wallet } = pkg;

// Generate a new wallet
const newWallet = wallet.generate();
console.log(JSON.stringify(newWallet, null, 2));