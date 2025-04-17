import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '@/lib/api';
import { Content } from '@/types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getAllContent', () => {
    it('should fetch all content', async () => {
      const mockContent = [
        { id: '1', title: 'Content 1' },
        { id: '2', title: 'Content 2' },
      ];
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockContent,
      });
      
      const result = await api.getAllContent();
      
      expect(result).toEqual(mockContent);
      expect(mockFetch).toHaveBeenCalledWith('/api/content');
    });

    it('should handle errors', async () => {
      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });
      
      await expect(api.getAllContent()).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledWith('/api/content');
    });
  });

  describe('getContent', () => {
    it('should fetch specific content by id', async () => {
      const mockContent = { id: '1', title: 'Content 1' };
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockContent,
      });
      
      const result = await api.getContent('1');
      
      expect(result).toEqual(mockContent);
      expect(mockFetch).toHaveBeenCalledWith('/api/content/1');
    });
  });

  describe('likeContent', () => {
    it('should send like request', async () => {
      const mockResponse = { id: '1', likeCount: 5 };
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      const result = await api.likeContent('1', 'nano_test123');
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/content/1/like', expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
        body: expect.stringContaining('nano_test123'),
      }));
    });
  });

  describe('verifyWallet', () => {
    it('should verify wallet address', async () => {
      const mockResponse = {
        address: 'nano_test123',
        balance: 5.5,
        valid: true,
      };
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      const result = await api.verifyWallet('nano_test123');
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/wallet/verify', expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
        body: expect.stringContaining('nano_test123'),
      }));
    });
  });

  describe('checkPayment', () => {
    it('should check payment status', async () => {
      const mockResponse = { paid: true };
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      const paymentData = {
        from: 'nano_sender123',
        to: 'nano_receiver123',
        amount: 1.5,
        contentId: '1',
      };
      
      const result = await api.checkPayment(paymentData);
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/payment/check', expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
        body: expect.stringContaining('nano_sender123'),
      }));
    });
  });

  describe('getEstimatedEarnings', () => {
    it('should fetch estimated earnings', async () => {
      const mockResponse = { estimatedEarnings: 25.5 };
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      const result = await api.getEstimatedEarnings('nano_test123');
      
      expect(result).toEqual(mockResponse.estimatedEarnings);
      expect(mockFetch).toHaveBeenCalledWith('/api/rewards/estimated-earnings', expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
        body: expect.stringContaining('nano_test123'),
      }));
    });
  });

  describe('uploadContent', () => {
    it('should upload content', async () => {
      const mockResponse: Content = {
        id: '1',
        title: 'Test Upload',
        type: 'image',
        originalUrl: '/uploads/test-image.jpg',
        blurredUrl: '/uploads/test-image-blur.jpg',
        price: 0.5,
        walletAddress: 'nano_test123',
        likeCount: 0,
        createdAt: new Date().toISOString(),
        isPaid: false,
        status: 'active',
      };
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      const formData = new FormData();
      formData.append('title', 'Test Upload');
      formData.append('price', '0.5');
      formData.append('wallet', 'nano_test123');
      
      const result = await api.uploadContent(formData);
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/content/upload', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }));
    });
  });
});