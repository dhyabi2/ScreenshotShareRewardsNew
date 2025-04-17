import { describe, it, expect, vi, beforeEach } from 'vitest';
import { xnoService } from '../utils/xnoService';
import { isValidXNOAddress } from '../helpers/validators';

// Mock the validators module
vi.mock('../helpers/validators', () => ({
  isValidXNOAddress: vi.fn(),
}));

describe('XNOService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('verifyWallet', () => {
    it('should return valid wallet info for valid address', async () => {
      // Mock the validator to return true
      (isValidXNOAddress as any).mockReturnValue(true);
      
      const address = 'nano_valid123';
      const result = await xnoService.verifyWallet(address);
      
      expect(result.valid).toBe(true);
      expect(result.address).toBe(address);
      expect(result.balance).toBeGreaterThanOrEqual(0);
      expect(isValidXNOAddress).toHaveBeenCalledWith(address);
    });

    it('should return invalid wallet info for invalid address', async () => {
      // Mock the validator to return false
      (isValidXNOAddress as any).mockReturnValue(false);
      
      const address = 'invalid_address';
      const result = await xnoService.verifyWallet(address);
      
      expect(result.valid).toBe(false);
      expect(result.address).toBe(address);
      expect(result.balance).toBe(0);
      expect(isValidXNOAddress).toHaveBeenCalledWith(address);
    });
  });

  describe('getWalletBalance', () => {
    it('should return a balance for any wallet address', async () => {
      const address = 'nano_test123';
      const balance = await xnoService.getWalletBalance(address);
      
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it('should return consistent balance for the same wallet', async () => {
      const address = 'nano_consistent123';
      
      const balance1 = await xnoService.getWalletBalance(address);
      const balance2 = await xnoService.getWalletBalance(address);
      
      expect(balance1).toBe(balance2);
    });

    it('should return different balances for different wallets', async () => {
      const address1 = 'nano_test1';
      const address2 = 'nano_test2';
      
      const balance1 = await xnoService.getWalletBalance(address1);
      const balance2 = await xnoService.getWalletBalance(address2);
      
      // This could theoretically fail in extremely rare cases
      // where the hashing happens to give the same result
      expect(balance1).not.toBe(balance2);
    });
  });

  describe('checkPayment', () => {
    it('should confirm payment (simulated)', async () => {
      const result = await xnoService.checkPayment(
        'nano_sender123',
        'nano_receiver123',
        1.5
      );
      
      expect(result).toBe(true);
    });
  });

  describe('validators', () => {
    it('should validate proper XNO addresses', () => {
      // Restore the actual implementation for this test
      vi.resetModules();
      
      const { isValidXNOAddress } = require('../helpers/validators');
      
      // Valid addresses (according to the regex pattern)
      expect(isValidXNOAddress('nano_1valid3fof5kdbchdo6mbnd5rhfcz8rafkitnob4iccyt8hx3zx7ca4819pyt')).toBe(true);
      expect(isValidXNOAddress('xno_1valid3fof5kdbchdo6mbnd5rhfcz8rafkitnob4iccyt8hx3zx7ca4819pyt')).toBe(true);
      
      // Invalid addresses
      expect(isValidXNOAddress('invalid_address')).toBe(false);
      expect(isValidXNOAddress('nano_too_short')).toBe(false);
      expect(isValidXNOAddress('bnb_1valid3fof5kdbchdo6mbnd5rhfcz8rafkitnob4iccyt8hx3zx7ca4819pyt')).toBe(false);
    });
  });
});