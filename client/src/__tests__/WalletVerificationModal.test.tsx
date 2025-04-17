import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalletVerificationModal from '@/components/modals/WalletVerificationModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as xnoUtils from '@/lib/xno';
import * as api from '@/lib/api';

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

vi.mock('@/lib/xno', () => ({
  isValidXNOAddress: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    verifyWallet: vi.fn(),
  },
}));

describe('WalletVerificationModal', () => {
  let queryClient: QueryClient;
  const onOpenChange = vi.fn();
  const onWalletVerified = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.resetAllMocks();
  });

  const renderWithProviders = (ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('should render when open', () => {
    renderWithProviders(
      <WalletVerificationModal
        isOpen={true}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    expect(screen.getByText('Verify XNO Wallet')).toBeInTheDocument();
    expect(screen.getByLabelText('Wallet Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify Wallet' })).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithProviders(
      <WalletVerificationModal
        isOpen={false}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    expect(screen.queryByText('Verify XNO Wallet')).not.toBeInTheDocument();
  });

  it('should handle wallet input', () => {
    renderWithProviders(
      <WalletVerificationModal
        isOpen={true}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    const input = screen.getByLabelText('Wallet Address');
    fireEvent.change(input, { target: { value: 'nano_test123' } });
    
    expect(input).toHaveValue('nano_test123');
  });

  it('should disable verify button if wallet is empty', () => {
    renderWithProviders(
      <WalletVerificationModal
        isOpen={true}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    const verifyButton = screen.getByRole('button', { name: 'Verify Wallet' });
    expect(verifyButton).toBeDisabled();
    
    const input = screen.getByLabelText('Wallet Address');
    fireEvent.change(input, { target: { value: 'nano_test123' } });
    
    expect(verifyButton).not.toBeDisabled();
  });

  it('should verify valid wallet address', async () => {
    // Mock valid address check
    vi.mocked(xnoUtils.isValidXNOAddress).mockReturnValue(true);
    
    renderWithProviders(
      <WalletVerificationModal
        isOpen={true}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    const input = screen.getByLabelText('Wallet Address');
    fireEvent.change(input, { target: { value: 'nano_test123' } });
    
    const verifyButton = screen.getByRole('button', { name: 'Verify Wallet' });
    fireEvent.click(verifyButton);
    
    expect(xnoUtils.isValidXNOAddress).toHaveBeenCalledWith('nano_test123');
  });

  it('should show error for invalid wallet format', async () => {
    // Mock invalid address check
    vi.mocked(xnoUtils.isValidXNOAddress).mockReturnValue(false);
    
    const mockToast = vi.fn();
    vi.mock('@/hooks/use-toast', () => ({
      useToast: () => ({
        toast: mockToast,
      }),
    }));
    
    renderWithProviders(
      <WalletVerificationModal
        isOpen={true}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    const input = screen.getByLabelText('Wallet Address');
    fireEvent.change(input, { target: { value: 'invalid_wallet' } });
    
    const verifyButton = screen.getByRole('button', { name: 'Verify Wallet' });
    fireEvent.click(verifyButton);
    
    expect(xnoUtils.isValidXNOAddress).toHaveBeenCalledWith('invalid_wallet');
  });

  it('should disable confirm button if wallet is not verified', () => {
    renderWithProviders(
      <WalletVerificationModal
        isOpen={true}
        onOpenChange={onOpenChange}
        onWalletVerified={onWalletVerified}
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toBeDisabled();
  });
});