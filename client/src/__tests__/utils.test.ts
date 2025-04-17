import { describe, it, expect } from 'vitest';
import { formatXNO, isValidXNOAddress, truncateAddress, generatePaymentUrl } from '../lib/xno';

describe('XNO Utilities', () => {
  describe('isValidXNOAddress', () => {
    it('should validate proper XNO addresses', () => {
      // Valid XNO addresses
      expect(isValidXNOAddress('nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkpe7eihlntd5zpch8griakw')).toBe(true);
      expect(isValidXNOAddress('nano_3wm37qz19zhei7nzscjcopbrbnnachs4p1gnwo5oroi3qonw6inwgoeuufdp')).toBe(true);
      
      // Invalid addresses
      expect(isValidXNOAddress('not_an_address')).toBe(false);
      expect(isValidXNOAddress('')).toBe(false);
      expect(isValidXNOAddress('nano_1234')).toBe(false);
    });
  });

  describe('formatXNO', () => {
    it('should format XNO amounts correctly', () => {
      expect(formatXNO(1)).toBe('1.00');
      expect(formatXNO(0.5)).toBe('0.50');
      expect(formatXNO(10.123)).toBe('10.12');
      expect(formatXNO(0)).toBe('0.00');
      expect(formatXNO(1000)).toBe('1000.00');
    });
  });

  describe('truncateAddress', () => {
    it('should truncate addresses to the specified length', () => {
      const address = 'nano_1abcdefghijklmnopqrstuvwxyz';
      
      // Default truncation (5, 5)
      expect(truncateAddress(address)).toBe('nano_...vwxyz');
      
      // Custom truncation
      expect(truncateAddress(address, 3, 4)).toBe('nano...wxyz');
      expect(truncateAddress(address, 10, 8)).toBe('nano_1abcdef...stuvwxyz');
      
      // Short address (no truncation needed)
      const shortAddress = 'nano_123';
      expect(truncateAddress(shortAddress)).toBe(shortAddress);
    });
  });

  describe('generatePaymentUrl', () => {
    it('should generate proper XNO payment URLs', () => {
      const receiverAddress = 'nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkpe7eihlntd5zpch8griakw';
      const amount = 1.5;
      const message = 'Test payment';
      
      const url = generatePaymentUrl(receiverAddress, amount, message);
      
      // Check URL structure
      expect(url.startsWith('nano:')).toBe(true);
      expect(url.includes(receiverAddress)).toBe(true);
      expect(url.includes('amount=1.5')).toBe(true);
      expect(url.includes('message=Test%20payment')).toBe(true);
      
      // Without message
      const simpleUrl = generatePaymentUrl(receiverAddress, amount);
      expect(simpleUrl.startsWith('nano:')).toBe(true);
      expect(simpleUrl.includes(receiverAddress)).toBe(true);
      expect(simpleUrl.includes('amount=1.5')).toBe(true);
      expect(simpleUrl.includes('message=')).toBe(false);
    });
  });
});