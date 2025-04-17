import { describe, it, expect } from 'vitest';
import { isValidXNOAddress, formatXNO, truncateAddress, generatePaymentUrl } from '@/lib/xno';

describe('XNO Utilities', () => {
  describe('isValidXNOAddress', () => {
    it('should validate proper XNO addresses', () => {
      // Valid addresses (according to the pattern)
      expect(isValidXNOAddress('nano_1valid3fof5kdbchdo6mbnd5rhfcz8rafkitnob4iccyt8hx3zx7ca4819pyt')).toBe(true);
      expect(isValidXNOAddress('xno_1valid3fof5kdbchdo6mbnd5rhfcz8rafkitnob4iccyt8hx3zx7ca4819pyt')).toBe(true);
      
      // Invalid addresses
      expect(isValidXNOAddress('invalid_address')).toBe(false);
      expect(isValidXNOAddress('nano_too_short')).toBe(false);
      expect(isValidXNOAddress('btc_1valid3fof5kdbchdo6mbnd5rhfcz8rafkitnob4iccyt8hx3zx7ca4819pyt')).toBe(false);
      expect(isValidXNOAddress('')).toBe(false);
    });
  });

  describe('formatXNO', () => {
    it('should format XNO amounts correctly', () => {
      expect(formatXNO(1)).toBe('1.00');
      expect(formatXNO(0.5)).toBe('0.50');
      expect(formatXNO(0.123456)).toBe('0.12');
      expect(formatXNO(1000)).toBe('1,000.00');
      expect(formatXNO(0)).toBe('0.00');
    });
  });

  describe('truncateAddress', () => {
    it('should truncate addresses to the specified length', () => {
      const address = 'nano_1234567890abcdefghijklmnopqrstuvwxyz';
      
      expect(truncateAddress(address)).toBe('nano_...wxyz');
      expect(truncateAddress(address, 4, 4)).toBe('nano...wxyz');
      expect(truncateAddress(address, 10, 5)).toBe('nano_12345...vwxyz');
      
      // Short address (shouldn't truncate)
      const shortAddress = 'nano_12345';
      expect(truncateAddress(shortAddress)).toBe(shortAddress);
    });
  });

  describe('generatePaymentUrl', () => {
    it('should generate proper XNO payment URLs', () => {
      const receiverAddress = 'nano_1234567890abcdefghijklmnopqrstuvwxyz';
      const amount = 1.5;
      const message = 'Test payment';
      
      const url = generatePaymentUrl(receiverAddress, amount, message);
      
      expect(url).toContain(receiverAddress);
      expect(url).toContain('1.5');
      expect(url).toContain('Test%20payment');
      expect(url.startsWith('https://')).toBe(true);
      
      // Without message
      const urlNoMessage = generatePaymentUrl(receiverAddress, amount);
      expect(urlNoMessage).toContain(receiverAddress);
      expect(urlNoMessage).toContain('1.5');
      expect(urlNoMessage).not.toContain('message=');
    });
  });
});