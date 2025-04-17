import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import WalletManager from '@/components/WalletManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatXNO } from '@/lib/xno';

export default function Wallet() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  
  // Get estimated earnings if wallet is available
  const { data: earningsData } = useQuery({
    queryKey: ['rewards', 'estimated', walletAddress],
    queryFn: () => api.getEstimatedEarnings(walletAddress),
    enabled: !!walletAddress,
  });
  
  // Get wallet uploaded content
  const { data: contentData } = useQuery({
    queryKey: ['content', 'wallet', walletAddress],
    queryFn: async () => {
      const allContent = await api.getAllContent();
      return allContent.filter(content => content.walletAddress === walletAddress);
    },
    enabled: !!walletAddress,
  });
  
  const handleWalletUpdated = (address: string) => {
    setWalletAddress(address);
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Wallet Management</h1>
          <p className="text-muted-foreground">
            Manage your XNO wallet, send and receive funds, and track your earnings
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <WalletManager 
              walletAddress={walletAddress}
              onWalletUpdated={handleWalletUpdated}
            />
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Estimated Rewards</CardTitle>
                <CardDescription>Your current estimated earnings</CardDescription>
              </CardHeader>
              <CardContent>
                {walletAddress ? (
                  <div className="flex flex-col">
                    <span className="text-3xl font-bold">
                      {formatXNO(earningsData?.estimatedEarnings || 0)} XNO
                    </span>
                    <span className="text-muted-foreground text-sm mt-1">
                      {earningsData?.estimatedEarnings ? 
                        'To be distributed from the daily reward pool' : 
                        'No estimated earnings yet. Upload or like content to earn rewards.'}
                    </span>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Connect or create a wallet to see your estimated earnings
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Your Content</CardTitle>
                <CardDescription>Content you've shared</CardDescription>
              </CardHeader>
              <CardContent>
                {walletAddress ? (
                  contentData && contentData.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Total items: {contentData.length}</div>
                      <div className="text-sm font-medium">
                        Total likes: {contentData.reduce((sum, item) => sum + item.likeCount, 0)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      You haven't uploaded any content yet
                    </div>
                  )
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Connect or create a wallet to see your content
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}