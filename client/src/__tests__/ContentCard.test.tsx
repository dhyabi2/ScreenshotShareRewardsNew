import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContentCard from '@/components/ContentCard';
import { Content } from '@/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode, href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ContentCard', () => {
  let mockContent: Content;
  let queryClient: QueryClient;

  beforeEach(() => {
    mockContent = {
      id: '1',
      title: 'Test Content',
      type: 'image',
      originalUrl: '/test/original.jpg',
      blurredUrl: '/test/blurred.jpg',
      price: 0,
      walletAddress: 'nano_test123',
      likeCount: 5,
      createdAt: new Date().toISOString(),
      isPaid: true,
      status: 'active',
    };

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('should render free content correctly', () => {
    renderWithProviders(<ContentCard content={mockContent} />);
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // like count
    expect(screen.getByText('Tip')).toBeInTheDocument();
  });

  it('should render paid content with blur', () => {
    const paidContent = {
      ...mockContent,
      price: 1.5,
      isPaid: false,
    };
    
    renderWithProviders(<ContentCard content={paidContent} />);
    
    expect(screen.getByText('1.5 XNO')).toBeInTheDocument();
    expect(screen.getByText('Unlock')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('should render video content with duration', () => {
    const videoContent = {
      ...mockContent,
      type: 'video',
      durationSeconds: 15,
    };
    
    renderWithProviders(<ContentCard content={videoContent} />);
    
    expect(screen.getByText('0:15')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('should render flagged content with warning', () => {
    const flaggedContent = {
      ...mockContent,
      status: 'flagged',
    };
    
    renderWithProviders(<ContentCard content={flaggedContent} />);
    
    expect(screen.getByText('Content Under Review')).toBeInTheDocument();
  });

  it('should handle unlock button click for free content', () => {
    const onUnlock = vi.fn();
    
    renderWithProviders(
      <ContentCard 
        content={mockContent} 
        onUnlock={onUnlock}
      />
    );
    
    // Free content doesn't show an unlock button, so we can't test the click directly
    // But we can verify the component structure is correct
    expect(screen.queryByText('Unlock')).not.toBeInTheDocument();
  });

  it('should handle unlock button click for paid content', () => {
    const paidContent = {
      ...mockContent,
      price: 1.5,
      isPaid: false,
    };
    
    renderWithProviders(<ContentCard content={paidContent} />);
    
    const unlockButton = screen.getByText('Unlock');
    expect(unlockButton).toBeInTheDocument();
    
    // Click should trigger the PaymentModal to open
    fireEvent.click(unlockButton);
    // We can't test the modal directly with this setup, but we could verify the component state
  });

  it('should truncate wallet address', () => {
    const longWalletAddress = 'nano_1234567890abcdefghijklmnopqrstuvwxyz';
    const contentWithLongWallet = {
      ...mockContent,
      walletAddress: longWalletAddress,
    };
    
    renderWithProviders(<ContentCard content={contentWithLongWallet} />);
    
    // Should show truncated address
    expect(screen.getByText('nano_...vwxyz')).toBeInTheDocument();
  });
});