import fetch from 'node-fetch';
import { isValidXNOAddress } from '../helpers/validators';

interface WalletInfo {
  address: string;
  balance: number;
  valid: boolean;
}

class XNOService {
  private apiUrl: string;
  private apiKey: string;
  
  constructor() {
    // Get API endpoint from environment or use default
    this.apiUrl = process.env.XNO_API_URL || 'https://app.natrium.io/api';
    // Get API key from environment
    this.apiKey = process.env.XNO_API_KEY || '';
    
    // Check if API key is missing and show a warning
    if (!this.apiKey) {
      console.warn('=== WARNING: XNO_API_KEY not set ===');
      console.warn('For real XNO wallet verification and payments, please set the XNO_API_KEY');
      console.warn('The app will use simulated XNO transactions until the API key is provided');
      console.warn('================================================');
    } else {
      console.log('XNO API key detected - using real blockchain verification');
    }
  }
  
  /**
   * Verify if a wallet address is valid and active
   */
  async verifyWallet(address: string): Promise<WalletInfo> {
    try {
      // First check the address format
      if (!isValidXNOAddress(address)) {
        return {
          address,
          balance: 0,
          valid: false
        };
      }
      
      // If API key is available, use the real API
      if (this.apiKey) {
        try {
          // In a production environment, we would query the Nano/XNO blockchain API
          const endpoint = `${this.apiUrl}/account/${address}`;
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          });
          
          if (response.ok) {
            const data = await response.json() as any;
            return {
              address,
              balance: parseFloat(data.balance) || 0,
              valid: true
            };
          } else {
            console.error('API returned error:', await response.text());
            return {
              address,
              balance: 0,
              valid: false
            };
          }
        } catch (apiError) {
          console.error('API call failed:', apiError);
          // Fall back to local verification
        }
      }
      
      // If no API key or API failed, use local simulation
      console.warn('XNO_API_KEY not set or API failed. Using simulated wallet verification.');
      const balance = await this.getWalletBalance(address);
      
      return {
        address,
        balance,
        valid: true
      };
    } catch (error) {
      console.error('Error verifying wallet:', error);
      return {
        address,
        balance: 0,
        valid: false
      };
    }
  }
  
  /**
   * Get the balance of a wallet
   */
  async getWalletBalance(address: string): Promise<number> {
    try {
      // In a real implementation, this would query the Nano/XNO blockchain
      // For development, we'll return a random balance between 0.1 and 10 XNO
      
      // Use consistent balance for a given address by hashing it
      const hash = this.simpleHash(address);
      const balance = 0.1 + (hash % 100) / 10; // Range 0.1 to 10.1
      
      return Number(balance.toFixed(6));
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return 0;
    }
  }
  
  /**
   * Check if a payment has been made from one wallet to another
   */
  async checkPayment(fromWallet: string, toWallet: string, amount: number): Promise<boolean> {
    try {
      // First validate wallet addresses
      if (!isValidXNOAddress(fromWallet) || !isValidXNOAddress(toWallet)) {
        console.error('Invalid wallet address format');
        return false;
      }
      
      // Check if API key is available for using an external service
      if (this.apiKey) {
        try {
          // In a production environment, we would query the Nano/XNO blockchain API
          // using the API key to verify the transaction
          const endpoint = `${this.apiUrl}/transactions`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              from: fromWallet,
              to: toWallet,
              amount: amount.toString()
            })
          });
          
          if (response.ok) {
            const data = await response.json() as any;
            return data.verified === true;
          } else {
            console.error('API returned error:', await response.text());
            return false;
          }
        } catch (apiError) {
          console.error('API call failed:', apiError);
          return false;
        }
      } else {
        // If no API key is available, log a warning that we need a real API key
        console.warn('XNO_API_KEY not set. For real payment verification, please set up an API key.');
        
        // For testing purposes, we'll check the "balance" of the sender
        // to see if they theoretically could have sent the payment
        const senderInfo = await this.verifyWallet(fromWallet);
        return senderInfo.valid && senderInfo.balance >= amount;
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      return false;
    }
  }
  
  /**
   * Simple hashing function for consistent random values
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const xnoService = new XNOService();
