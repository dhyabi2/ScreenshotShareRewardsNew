import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { formatXNO, truncateAddress } from '@/lib/xno';
import { Loader2, ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface WalletManagerProps {
  walletAddress?: string;
  onWalletUpdated?: (address: string) => void;
}

export default function WalletManager({ walletAddress: initialWalletAddress, onWalletUpdated }: WalletManagerProps) {
  const [walletAddress, setWalletAddress] = useState<string>(initialWalletAddress || '');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [sendToAddress, setSendToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [openSendDialog, setOpenSendDialog] = useState(false);
  const [openReceiveDialog, setOpenReceiveDialog] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Always save wallet details in localStorage when available
  useEffect(() => {
    if (walletAddress && privateKey) {
      localStorage.setItem('xno_wallet_address', walletAddress);
      // Always store private key in localStorage for seamless user experience
      localStorage.setItem('xno_private_key', privateKey);
    }
  }, [walletAddress, privateKey]);
  
  // Load wallet from localStorage if available
  useEffect(() => {
    if (!walletAddress) {
      const savedAddress = localStorage.getItem('xno_wallet_address');
      const savedKey = localStorage.getItem('xno_private_key');
      
      if (savedAddress) {
        setWalletAddress(savedAddress);
        if (savedKey) setPrivateKey(savedKey);
        
        if (onWalletUpdated) {
          onWalletUpdated(savedAddress);
        }
      }
    }
  }, [walletAddress, onWalletUpdated]);
  
  // Get detailed wallet info from the API
  const { data: walletInfo, isLoading, isError, refetch } = useQuery({
    queryKey: ['wallet', 'info', walletAddress],
    queryFn: () => api.getWalletInfo(walletAddress),
    enabled: !!walletAddress,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });
  
  // Get transaction history
  const { data: transactionData } = useQuery({
    queryKey: ['wallet', 'transactions', walletAddress],
    queryFn: () => api.getWalletTransactions(walletAddress),
    enabled: !!walletAddress,
  });
  
  // Mutation to create a new wallet
  const generateWalletMutation = useMutation({
    mutationFn: api.generateWallet,
    onSuccess: (data) => {
      setWalletAddress(data.address);
      setPrivateKey(data.privateKey);
      
      if (onWalletUpdated) {
        onWalletUpdated(data.address);
      }
      
      toast({
        title: "Wallet Created",
        description: "New XNO wallet generated successfully. Keep your private key safe!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Creating Wallet",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation to receive pending transactions
  const receiveTransactionsMutation = useMutation({
    mutationFn: () => api.receiveTransactions(walletAddress, privateKey),
    onSuccess: (data) => {
      if (data.received) {
        toast({
          title: "Transactions Received",
          description: `Received ${data.count} transaction(s) for a total of ${formatXNO(data.totalAmount)} XNO`,
        });
        
        // Refetch the wallet info to show updated balance
        queryClient.invalidateQueries({ queryKey: ['wallet', 'info', walletAddress] });
        queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions', walletAddress] });
      } else {
        toast({
          title: "No Pending Transactions",
          description: "There are no pending transactions to receive.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error Receiving Transactions",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation to send XNO
  const sendTransactionMutation = useMutation({
    mutationFn: () => api.sendTransaction(walletAddress, privateKey, sendToAddress, parseFloat(amount)),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Transaction Sent",
          description: `Successfully sent ${amount} XNO to ${truncateAddress(sendToAddress)}`,
        });
        
        // Reset form and close dialog
        setSendToAddress('');
        setAmount('');
        setOpenSendDialog(false);
        
        // Refetch the wallet info to show updated balance
        queryClient.invalidateQueries({ queryKey: ['wallet', 'info', walletAddress] });
        queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions', walletAddress] });
      } else {
        toast({
          title: "Transaction Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error Sending Transaction",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Get deposit QR code
  const { data: depositQrData } = useQuery({
    queryKey: ['wallet', 'deposit-qr', walletAddress, depositAmount],
    queryFn: () => api.getDepositQrCode(walletAddress, depositAmount ? parseFloat(depositAmount) : undefined),
    enabled: !!walletAddress && openReceiveDialog,
  });
  
  const handleGenerateWallet = () => {
    generateWalletMutation.mutate();
  };
  
  const handleReceiveTransactions = () => {
    if (!privateKey) {
      toast({
        title: "Private Key Required",
        description: "Please enter your private key to receive transactions.",
        variant: "destructive",
      });
      return;
    }
    
    receiveTransactionsMutation.mutate();
  };
  
  const handleSendTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!privateKey) {
      toast({
        title: "Private Key Required",
        description: "Please enter your private key to send transactions.",
        variant: "destructive",
      });
      return;
    }
    
    if (!sendToAddress || !amount) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient address and amount.",
        variant: "destructive",
      });
      return;
    }
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive amount.",
        variant: "destructive",
      });
      return;
    }
    
    if (walletInfo && amountValue > walletInfo.balance) {
      toast({
        title: "Insufficient Balance",
        description: `Your balance of ${formatXNO(walletInfo.balance)} XNO is not enough to send ${amount} XNO.`,
        variant: "destructive",
      });
      return;
    }
    
    sendTransactionMutation.mutate();
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied",
          description: `${label} copied to clipboard.`,
        });
      },
      () => {
        toast({
          title: "Failed to Copy",
          description: "Please copy manually.",
          variant: "destructive",
        });
      }
    );
  };
  
  // If no wallet is set up, show wallet creation UI
  if (!walletAddress) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Create a Wallet</CardTitle>
          <CardDescription>You need an XNO wallet to use this application</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Generate a new XNO wallet to unlock, tip, and receive rewards.</p>
          <Button 
            onClick={handleGenerateWallet} 
            disabled={generateWalletMutation.isPending}
            className="w-full"
          >
            {generateWalletMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Wallet...
              </>
            ) : (
              'Generate New Wallet'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>XNO Wallet</CardTitle>
            <CardDescription>Manage your XNO funds</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()} 
            title="Refresh wallet info"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="balance">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="balance">Balance</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="balance" className="space-y-4">
            <div className="flex flex-col space-y-4 mt-4">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : isError ? (
                <div className="text-center py-4 text-red-500">
                  Error loading wallet info. Please try again.
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <Label>Wallet Address</Label>
                    <div className="flex items-center">
                      <span className="text-sm font-mono truncate max-w-[200px]">
                        {truncateAddress(walletAddress, 8, 8)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => copyToClipboard(walletAddress, 'Wallet address')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => window.open(`https://nanexplorer.com/nano/${walletAddress}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Label>Balance</Label>
                    <span className="text-xl font-semibold">
                      {formatXNO(walletInfo?.balance || 0)} XNO
                    </span>
                  </div>
                  
                  {walletInfo?.pending && walletInfo.pending.blocks.length > 0 && (
                    <div className="flex justify-between items-center">
                      <Label>Pending Transactions</Label>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">
                          {walletInfo.pending.blocks.length} transaction(s) - {formatXNO(walletInfo.pending.totalAmount)} XNO
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReceiveTransactions}
                          disabled={receiveTransactionsMutation.isPending}
                        >
                          {receiveTransactionsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Receive'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                onClick={() => setOpenSendDialog(true)}
                className="w-full"
                variant="outline"
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Send
              </Button>
              <Button
                onClick={() => setOpenReceiveDialog(true)}
                className="w-full"
                variant="outline"
              >
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Receive
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="transactions">
            <div className="space-y-4 mt-4">
              <h3 className="text-sm font-medium">Recent Transactions</h3>
              
              {!transactionData || transactionData.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No transactions found
                </p>
              ) : (
                <div className="space-y-2">
                  {transactionData.transactions.map((tx) => (
                    <div key={tx.hash} className="border rounded-md p-3 text-sm">
                      <div className="flex justify-between">
                        <span className={tx.type === 'send' ? 'text-red-500' : 'text-green-500'}>
                          {tx.type === 'send' ? '↑ Sent' : '↓ Received'}
                        </span>
                        <span>{formatXNO(parseFloat(tx.amount))} XNO</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{truncateAddress(tx.account, 6, 6)}</span>
                        <span>{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Unknown time'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="settings">
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="privateKey">Private Key</Label>
                <div className="flex">
                  <Input
                    id="privateKey"
                    type={showPrivateKey ? "text" : "password"}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="Enter your wallet private key"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    className="ml-2"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? 'Hide' : 'Show'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your private key is required to sign transactions. It never leaves your device and is stored locally.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Send Dialog */}
      <Dialog open={openSendDialog} onOpenChange={setOpenSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send XNO</DialogTitle>
            <DialogDescription>
              Send XNO to another wallet address
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSendTransaction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="toAddress">Recipient Address</Label>
              <Input
                id="toAddress"
                placeholder="nano_..."
                value={sendToAddress}
                onChange={(e) => setSendToAddress(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (XNO)</Label>
              <Input
                id="amount"
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              
              {walletInfo && (
                <div className="flex justify-between text-xs mt-1">
                  <span>Available: {formatXNO(walletInfo.balance)} XNO</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={() => setAmount(walletInfo.balance.toString())}
                  >
                    Max
                  </Button>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setOpenSendDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={sendTransactionMutation.isPending}
              >
                {sendTransactionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send XNO'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Receive Dialog */}
      <Dialog open={openReceiveDialog} onOpenChange={setOpenReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive XNO</DialogTitle>
            <DialogDescription>
              Share your address or QR code to receive XNO
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Wallet Address</Label>
              <div className="flex">
                <Input
                  value={walletAddress}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() => copyToClipboard(walletAddress, 'Wallet address')}
                >
                  Copy
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="depositAmount">Request Amount (Optional)</Label>
              <Input
                id="depositAmount"
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>
            
            {depositQrData && (
              <div className="flex flex-col items-center justify-center p-4">
                <img 
                  src={depositQrData.qrCodeUrl} 
                  alt="Deposit QR Code" 
                  className="w-48 h-48 mb-2"
                />
                <p className="text-sm text-center">
                  Scan this QR code with a Nano wallet app to send XNO to this address
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}