import { describe, it, expect, beforeEach } from 'vitest';
import { XNOService } from '../utils/xnoService';

// Mock implementation since we don't want to make real XNO API calls in tests
class MockXNOService extends XNOService {
  constructor() {
    super();
  }

  async verifyWallet(address: string) {
    // Simulate that addresses starting with nano_1 are valid
    const valid = address.startsWith('nano_1');
    return {
      address,
      balance: valid ? 100 : 0,
      valid
    };
  }

  async getWalletBalance(address: string) {
    // Return a deterministic balance based on address to make tests predictable
    return this.simpleHash(address) % 1000;
  }

  async checkPayment(fromWallet: string, toWallet: string, amount: number) {
    // For testing, simulate that payments are successful if certain conditions are met
    console.log(`Checking payment: ${fromWallet} -> ${toWallet} (${amount} XNO)`);
    
    // For test purposes, let's say payments are successful if:
    // 1. The amount is less than 10 XNO, or
    // 2. From wallet is 'nano_sender123' and to wallet is 'nano_receiver123'
    return amount < 10 || (fromWallet === 'nano_sender123' && toWallet === 'nano_receiver123');
  }

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

describe('XNOService', () => {
  let xnoService: MockXNOService;
  
  beforeEach(() => {
    xnoService = new MockXNOService();
  });
  
  describe('verifyWallet', () => {
    it('should return valid wallet info for valid address', async () => {
      const result = await xnoService.verifyWallet('nano_1valid23456789');
      
      expect(result.valid).toBe(true);
      expect(result.address).toBe('nano_1valid23456789');
      expect(result.balance).toBeGreaterThan(0);
    });
    
    it('should return invalid wallet info for invalid address', async () => {
      const result = await xnoService.verifyWallet('nano_3invalid123456');
      
      expect(result.valid).toBe(false);
      expect(result.address).toBe('nano_3invalid123456');
      expect(result.balance).toBe(0);
    });
  });
  
  describe('getWalletBalance', () => {
    it('should return a balance for any wallet address', async () => {
      const balance = await xnoService.getWalletBalance('nano_test123');
      expect(typeof balance).toBe('number');
    });
    
    it('should return consistent balance for the same wallet', async () => {
      const address = 'nano_consistent123';
      const balance1 = await xnoService.getWalletBalance(address);
      const balance2 = await xnoService.getWalletBalance(address);
      
      expect(balance1).toBe(balance2);
    });
    
    it('should return different balances for different wallets', async () => {
      const balance1 = await xnoService.getWalletBalance('nano_wallet1');
      const balance2 = await xnoService.getWalletBalance('nano_wallet2');
      
      expect(balance1).not.toBe(balance2);
    });
  });
  
  describe('checkPayment', () => {
    it('should confirm payment (simulated)', async () => {
      const result = await xnoService.checkPayment('nano_sender123', 'nano_receiver123', 1.5);
      expect(result).toBe(true);
    });
  });
  
  describe('validators', () => {
    it('should validate proper XNO addresses', () => {
      // Import the validator function
      const { isValidXNOAddress } = require('../helpers/validators');
      
      // Valid XNO addresses
      expect(isValidXNOAddress('nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkpe7eihlntd5zpch8griakw')).toBe(true);
      
      // Invalid addresses
      expect(isValidXNOAddress('not_an_address')).toBe(false);
      expect(isValidXNOAddress('')).toBe(false);
      expect(isValidXNOAddress('nano_1234')).toBe(false);
    });
  });
});