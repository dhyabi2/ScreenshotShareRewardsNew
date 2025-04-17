import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';
import { Content } from '../types';

// Mock fetch
global.fetch = vi.fn();

function mockFetchResponse(data: any) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    status: 200
  });
}

function mockFetchError(status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'Error message' })
  });
}

describe('API Client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getAllContent', () => {
    it('should fetch all content', async () => {
      const mockContent = [
        { id: '1', title: 'Test Content 1', type: 'image' },
        { id: '2', title: 'Test Content 2', type: 'video' }
      ];
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse(mockContent));
      
      const result = await api.getAllContent();
      
      expect(fetch).toHaveBeenCalledWith('/api/content');
      expect(result).toEqual(mockContent);
    });
    
    it('should handle errors', async () => {
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchError());
      
      await expect(api.getAllContent()).rejects.toThrow();
      expect(fetch).toHaveBeenCalledWith('/api/content');
    });
  });

  describe('getContent', () => {
    it('should fetch specific content by id', async () => {
      const mockResponse: Content = {
        id: '1',
        title: 'Test Content',
        type: 'image',
        originalUrl: '/test.jpg',
        blurredUrl: '/test-blurred.jpg',
        price: 10,
        walletAddress: 'nano_test',
        likeCount: 0,
        createdAt: new Date().toISOString(),
        isPaid: false,
        status: 'active'
      };
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse(mockResponse));
      
      const result = await api.getContent('1');
      
      expect(fetch).toHaveBeenCalledWith('/api/content/1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('likeContent', () => {
    it('should send like request', async () => {
      const contentId = '1';
      const walletAddress = 'nano_test123';
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse({ success: true }));
      
      await api.likeContent(contentId, walletAddress);
      
      expect(fetch).toHaveBeenCalledWith('/api/content/1/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
    });
  });

  describe('verifyWallet', () => {
    it('should verify wallet address', async () => {
      const walletAddress = 'nano_test123';
      const mockResponse = { address: walletAddress, balance: 100, valid: true };
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse(mockResponse));
      
      const result = await api.verifyWallet(walletAddress);
      
      expect(fetch).toHaveBeenCalledWith('/api/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('checkPayment', () => {
    it('should check payment status', async () => {
      const fromWallet = 'nano_sender';
      const toWallet = 'nano_receiver';
      const amount = 10;
      const contentId = '1';
      const mockResponse = { paid: true };
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse(mockResponse));
      
      const result = await api.checkPayment(fromWallet, toWallet, amount, contentId);
      
      expect(fetch).toHaveBeenCalledWith('/api/payments/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromWallet, toWallet, amount, contentId })
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUserEstimatedEarnings', () => {
    it('should fetch estimated earnings', async () => {
      const walletAddress = 'nano_test123';
      const mockResponse = { estimatedEarnings: 50 };
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse(mockResponse));
      
      const result = await api.getUserEstimatedEarnings(walletAddress);
      
      expect(fetch).toHaveBeenCalledWith('/api/rewards/estimated-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('uploadContent', () => {
    it('should upload content', async () => {
      const formData = new FormData();
      const mockResponse = { id: '1', title: 'New Content' };
      
      // @ts-ignore - mocking fetch
      fetch.mockResolvedValueOnce(mockFetchResponse(mockResponse));
      
      const result = await api.uploadContent(formData);
      
      expect(fetch).toHaveBeenCalledWith('/api/content/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      expect(result).toEqual(mockResponse);
    });
  });
});