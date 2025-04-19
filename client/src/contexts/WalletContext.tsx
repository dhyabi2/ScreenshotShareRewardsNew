import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface WalletContextType {
  walletAddress: string;
  privateKey: string;
  isConnected: boolean;
  connectWallet: (address: string, key?: string) => void;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { toast } = useToast();

  // Load wallet from localStorage on initial load
  useEffect(() => {
    // Support both old and new localStorage keys for backward compatibility
    const savedWallet = localStorage.getItem('xno_wallet') || localStorage.getItem('xno_wallet_address');
    const savedKey = localStorage.getItem('xno_private_key');
    
    if (savedWallet) {
      setWalletAddress(savedWallet);
      if (savedKey) setPrivateKey(savedKey);
      setIsConnected(true);
      
      // Migrate old key format to new format if needed
      if (localStorage.getItem('xno_wallet') && !localStorage.getItem('xno_wallet_address')) {
        localStorage.setItem('xno_wallet_address', savedWallet);
      }
    }
  }, []);

  const connectWallet = (address: string, key?: string) => {
    setWalletAddress(address);
    localStorage.setItem('xno_wallet_address', address);
    localStorage.setItem('xno_wallet', address); // Keep both for compatibility
    
    if (key) {
      setPrivateKey(key);
      localStorage.setItem('xno_private_key', key);
    }
    
    setIsConnected(true);
    
    toast({
      title: 'Wallet Connected',
      description: 'Your XNO wallet has been connected successfully.'
    });
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    setPrivateKey('');
    setIsConnected(false);
    
    localStorage.removeItem('xno_wallet');
    localStorage.removeItem('xno_wallet_address');
    localStorage.removeItem('xno_private_key');
    
    toast({
      title: 'Wallet Disconnected',
      description: 'Your XNO wallet has been disconnected.'
    });
  };

  return (
    <WalletContext.Provider value={{
      walletAddress,
      privateKey,
      isConnected,
      connectWallet,
      disconnectWallet
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  
  return context;
};