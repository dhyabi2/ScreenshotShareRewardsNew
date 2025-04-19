import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Wallet as WalletIcon, Send, Download, RefreshCw, Copy, ExternalLink, ArrowUpCircle, ArrowDownCircle, CircleSlash } from "lucide-react";

interface WalletInfo {
  address: string;
  balance: number;
  qrCodeUrl?: string;
  pending?: {
    blocks: string[];
    totalAmount: number;
  };
}

interface Transaction {
  hash: string;
  amount: string;
  type: 'send' | 'receive';
  account: string;
  timestamp: string;
}

export default function Wallet() {
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState(() => {
    // Try to get from localStorage
    return localStorage.getItem('xno_wallet_address') || '';
  });
  const [validWallet, setValidWallet] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [privateKey, setPrivateKey] = useState(() => {
    // Always retrieve the private key from localStorage
    return localStorage.getItem('xno_private_key') || '';
  });
  const [hasPrivateKey, setHasPrivateKey] = useState(() => {
    return !!localStorage.getItem('xno_private_key');
  });
  
  // Save wallet address and private key to localStorage when they change
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem('xno_wallet_address', walletAddress);
    }
  }, [walletAddress]);
  
  // Save private key to localStorage when it changes
  useEffect(() => {
    if (privateKey) {
      localStorage.setItem('xno_private_key', privateKey);
      setHasPrivateKey(true);
    }
  }, [privateKey]);
  
  // Wallet info query with more frequent refresh and retry
  const { 
    data: walletInfo, 
    isLoading: walletInfoLoading,
    refetch: refetchWalletInfo,
    isSuccess: walletInfoSuccess
  } = useQuery({
    queryKey: ['/api/wallet/info', walletAddress],
    queryFn: () => {
      if (!walletAddress) {
        return Promise.resolve({ address: '', balance: 0 });
      }
      return api.getWalletInfo(walletAddress);
    },
    enabled: !!walletAddress,
    refetchInterval: 10000, // Refetch every 10 seconds for more responsiveness
    refetchOnWindowFocus: true, // Refresh when window gets focus
    refetchIntervalInBackground: true, // Keep refreshing even in background
    retry: true, // Retry failed requests
    retryDelay: 1000, // Wait 1 second between retries
  });
  
  // Transaction history query - with enhanced auto refresh
  const { 
    data: txHistory, 
    isLoading: txHistoryLoading,
    refetch: refetchTxHistory
  } = useQuery({
    queryKey: ['/api/wallet/transactions', walletAddress],
    queryFn: () => {
      if (!walletAddress) {
        return Promise.resolve({ transactions: [] });
      }
      return api.getWalletTransactions(walletAddress);
    },
    enabled: !!walletAddress && validWallet,
    select: (data) => data.transactions,
    refetchInterval: 10000, // Refresh every 10 seconds
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
    retry: true,
    retryDelay: 1000
  });
  
  // Upload stats query
  const { data: contentStats } = useQuery({
    queryKey: ['/api/content/wallet', walletAddress],
    queryFn: () => {
      if (!walletAddress) {
        return Promise.resolve({ content: [] });
      }
      return api.getContentByWallet(walletAddress);
    },
    enabled: !!walletAddress && validWallet,
    select: (data) => ({
      uploadCount: data.length,
      totalLikes: data.reduce((sum, content) => sum + content.likeCount, 0)
    }),
  });
  
  // Estimated earnings query
  const { data: earningsData } = useQuery({
    queryKey: ['/api/rewards/estimated-earnings', walletAddress],
    queryFn: () => {
      if (!walletAddress) {
        return Promise.resolve({ estimatedEarnings: 0 });
      }
      return api.getEstimatedEarnings(walletAddress);
    },
    enabled: !!walletAddress && validWallet,
  });
  
  // Verify wallet mutation
  const verifyWalletMutation = useMutation({
    mutationFn: (address: string) => api.verifyWallet(address),
    onSuccess: (data) => {
      setValidWallet(data.valid);
      if (data.valid) {
        toast({
          title: "Wallet Verified",
          description: `Connected to wallet with balance: ${data.balance.toFixed(6)} XNO`,
        });
        // Refetch wallet info after verifying
        refetchWalletInfo();
        refetchTxHistory();
      } else {
        toast({
          title: "Invalid Wallet",
          description: "The wallet address is invalid or not found on the network.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Send XNO mutation
  const sendXnoMutation = useMutation({
    mutationFn: (data: { fromAddress: string, privateKey: string, toAddress: string, amount: number }) => 
      api.sendTransaction(data.fromAddress, data.privateKey, data.toAddress, data.amount),
    onSuccess: (data) => {
      toast({
        title: "Transaction Sent",
        description: `Transaction successful. Hash: ${data.hash?.substring(0, 10)}...`,
      });
      setSendAmount('');
      setRecipientAddress('');
      // No longer clearing private key as we want to keep it for future transactions
      // Refetch wallet info after sending
      refetchWalletInfo();
      refetchTxHistory();
    },
    onError: (error: Error) => {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Receive pending funds mutation
  const receivePendingMutation = useMutation({
    mutationFn: (data: { address: string, privateKey: string }) => 
      api.receivePending(data.address, data.privateKey),
    onSuccess: (data) => {
      if (data.received && data.count > 0) {
        toast({
          title: "Funds Received",
          description: `Successfully received ${data.count} transactions totaling ${data.totalAmount} XNO`,
        });
      } else {
        toast({
          title: "No Pending Funds",
          description: "There are no pending transactions to receive",
        });
      }
      // Refetch wallet info after receiving
      refetchWalletInfo();
      refetchTxHistory();
    },
    onError: (error: Error) => {
      toast({
        title: "Receive Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Generate new wallet mutation
  const generateWalletMutation = useMutation({
    mutationFn: () => api.generateWallet(),
    onSuccess: (data) => {
      // Check if we actually got valid data before saving
      if (!data.address || !data.privateKey) {
        toast({
          title: "Wallet Generation Error",
          description: "Generated wallet data is missing address or private key",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Generated new wallet: ${data.address}`);
      console.log(`Private key length: ${data.privateKey.length}`);
      
      // Verify private key format (should be 64 characters hex string)
      const isValidPrivateKey = /^[0-9a-f]{64}$/i.test(data.privateKey);
      if (!isValidPrivateKey) {
        toast({
          title: "Invalid Private Key Format",
          description: "The generated private key has an invalid format",
          variant: "destructive",
        });
        return;
      }
      
      // Save wallet address and private key to localStorage directly
      localStorage.setItem('xno_wallet_address', data.address);
      localStorage.setItem('xno_private_key', data.privateKey);
      
      // Update state
      setWalletAddress(data.address);
      setPrivateKey(data.privateKey);
      setHasPrivateKey(true);
      
      // Mark wallet as valid without verification (since it's generated by us)
      setValidWallet(true);
      
      toast({
        title: "New Wallet Generated",
        description: "A new XNO wallet has been created and saved securely in your browser.",
      });
      
      // No need to verify generated wallets
      refetchWalletInfo();
      refetchTxHistory();
    },
    onError: (error: Error) => {
      toast({
        title: "Wallet Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // No wallet verification - all wallets are automatically considered valid
  
  // Handle sending XNO
  const handleSendXno = () => {
    if (!walletAddress || !privateKey || !recipientAddress || !sendAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter all required fields",
        variant: "destructive",
      });
      return;
    }
    
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }
    
    // Check if we have enough balance
    if (walletInfo && amount > walletInfo.balance) {
      toast({
        title: "Insufficient Balance",
        description: `Your balance (${walletInfo.balance.toFixed(6)} XNO) is lower than the amount you're trying to send`,
        variant: "destructive",
      });
      return;
    }
    
    sendXnoMutation.mutate({
      fromAddress: walletAddress,
      privateKey,
      toAddress: recipientAddress,
      amount
    });
  };
  
  // Handle receiving pending funds
  const handleReceivePending = () => {
    if (!walletAddress || !privateKey) {
      toast({
        title: "Missing Information",
        description: "Wallet address and private key are required",
        variant: "destructive",
      });
      return;
    }
    
    receivePendingMutation.mutate({
      address: walletAddress,
      privateKey
    });
  };
  
  // Effect to mark wallet as valid once address is entered
  useEffect(() => {
    if (walletAddress && !validWallet) {
      // Auto-mark wallet as valid when address is entered (no verification)
      setValidWallet(true);
      refetchWalletInfo();
      refetchTxHistory();
    }
  }, [walletAddress]);
  
  // Effect to auto-receive pending transactions when we have a wallet and private key
  useEffect(() => {
    // Check if we have a valid wallet with private key and pending transactions
    if (walletAddress && privateKey && walletInfo?.pending?.blocks?.length > 0) {
      // Auto-receive pending transactions
      console.log("Auto-receiving pending transactions...");
      receivePendingMutation.mutate({
        address: walletAddress,
        privateKey
      });
    }
  }, [walletInfo?.pending?.blocks, walletAddress, privateKey]);
  
  // Effect to explicitly receive pending transactions after generating a new wallet
  useEffect(() => {
    if (generateWalletMutation.isSuccess && walletAddress && privateKey) {
      // Add a small delay to ensure the wallet info has been fetched
      const timer = setTimeout(() => {
        console.log("New wallet generated - checking for pending transactions...");
        // Force a wallet info refresh
        refetchWalletInfo().then(result => {
          if (result.data?.pending?.blocks?.length > 0) {
            console.log(`Found ${result.data.pending.blocks.length} pending transactions for new wallet - receiving...`);
            receivePendingMutation.mutate({
              address: walletAddress,
              privateKey
            });
          } else {
            console.log("No pending transactions for new wallet");
          }
        });
      }, 2000); // 2 second delay to ensure blockchain has time to register
      
      return () => clearTimeout(timer);
    }
  }, [generateWalletMutation.isSuccess, walletAddress, privateKey]);
  
  // Copy text to clipboard
  const copyToClipboard = (text: string, message = "Copied to clipboard") => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied",
        description: message,
      });
    });
  };
  
  // Format date to readable string
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6 text-center">
        <WalletIcon className="inline-block mr-2 h-8 w-8" />
        Wallet Management
      </h1>
      
      <div className="flex flex-col gap-6">
        {/* Wallet Connection Section */}
        <Card>
          <CardHeader>
            <CardTitle>Connect to your XNO Wallet</CardTitle>
            <CardDescription>
              Enter your Nano (XNO) wallet address to connect and manage your funds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="walletAddress">Your XNO Wallet Address</Label>
                  <div className="relative">
                    <Input
                      id="walletAddress"
                      placeholder="Enter your XNO wallet address (starts with nano_)"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="w-full"
                    />
                    {walletAddress && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(walletAddress)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        <Copy size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => generateWalletMutation.mutate()}
                  disabled={generateWalletMutation.isPending}
                >
                  {generateWalletMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate New Wallet
                </Button>
              </div>
            </div>
            
            {hasPrivateKey && (
              <div className="mt-4 p-3 border border-green-200 bg-green-50 rounded-md">
                <h3 className="font-medium text-green-800">Wallet Ready</h3>
                <p className="text-sm text-green-600">
                  Your wallet is ready to use. Private key has been securely saved in your browser's local storage.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(privateKey, "Private key copied to clipboard")}
                  >
                    <Copy size={16} className="mr-2" /> Copy Private Key
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-600"
                    onClick={() => {
                      const newKey = prompt("Enter your private key (64 character hex string):", privateKey);
                      if (newKey) {
                        // Verify key format
                        const isValidFormat = /^[0-9a-f]{64}$/i.test(newKey);
                        if (!isValidFormat) {
                          toast({
                            title: "Invalid Key Format",
                            description: "Private key must be a 64 character hex string",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // Update state and localStorage
                        setPrivateKey(newKey);
                        localStorage.setItem('xno_private_key', newKey);
                        toast({
                          title: "Private Key Updated",
                          description: "Your private key has been updated successfully"
                        });
                      }
                    }}
                  >
                    Update Private Key
                  </Button>
                </div>
              </div>
            )}
            
            {walletInfoSuccess && validWallet && hasPrivateKey && (
              <div className="mt-4 p-3 border border-blue-200 bg-blue-50 rounded-md">
                <h3 className="font-medium text-blue-800">Auto-Transactions Enabled</h3>
                <p className="text-sm text-blue-600">
                  Your private key is securely stored in your browser. All transactions will be processed automatically.
                  All wallet operations (send/receive) are ready to use.
                </p>
              </div>
            )}
            
            {walletInfoSuccess && validWallet && !hasPrivateKey && (
              <div className="mt-4 p-3 border border-amber-200 bg-amber-50 rounded-md">
                <h3 className="font-medium text-amber-800">Private Key Missing</h3>
                <p className="text-sm text-amber-600">
                  To perform send/receive operations, please click "Generate New Wallet" to create a new wallet with a private key that will be automatically saved.
                </p>
                <Button
                  variant="outline"
                  className="mt-2 bg-white border-amber-600 text-amber-700 hover:bg-amber-50"
                  onClick={() => generateWalletMutation.mutate()}
                  disabled={generateWalletMutation.isPending}
                >
                  {generateWalletMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate New Wallet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Wallet Details & Operations Section - Only show if wallet is valid */}
        {validWallet && (
          <Tabs defaultValue="balance" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="balance">Balance</TabsTrigger>
              <TabsTrigger value="send">Send XNO</TabsTrigger>
              <TabsTrigger value="receive">Receive</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>
            
            {/* Balance & Stats Tab */}
            <TabsContent value="balance">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Balance</CardTitle>
                  <CardDescription>
                    Your current XNO balance and account statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {walletInfoLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex flex-col p-4 border rounded-lg">
                        <span className="text-sm text-gray-500">Available Balance</span>
                        <span className="text-3xl font-bold text-primary">
                          {walletInfo?.balance?.toFixed(6)} XNO
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2 self-start"
                          onClick={() => refetchWalletInfo()}
                        >
                          <RefreshCw size={14} className="mr-1" /> Refresh
                        </Button>
                      </div>
                      
                      {walletInfo?.pending && walletInfo.pending.blocks.length > 0 && (
                        <div className="flex flex-col p-4 border rounded-lg bg-amber-50">
                          <span className="text-sm text-amber-700">Pending Deposits</span>
                          <span className="text-3xl font-bold text-amber-600">
                            {walletInfo.pending.totalAmount.toFixed(6)} XNO
                          </span>
                          <span className="text-sm text-amber-700 mt-1">
                            {walletInfo.pending.blocks.length} pending transaction(s)
                          </span>
                          <div className="flex gap-2 mt-2">
                            <Button 
                              variant="outline"
                              size="sm" 
                              className="self-start text-amber-700 border-amber-700"
                              onClick={handleReceivePending}
                              disabled={!privateKey || receivePendingMutation.isPending}
                            >
                              {receivePendingMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                              Receive Funds
                            </Button>
                            <Button 
                              variant="default"
                              size="sm" 
                              className="self-start bg-amber-600 hover:bg-amber-700"
                              onClick={() => {
                                // First check if we need to receive the funds with advanced options
                                api.getAccountInfo(walletAddress).then(info => {
                                  const isNewAccount = info?.error === 'Account not found';
                                  console.log(`Account status: ${isNewAccount ? 'NEW' : 'EXISTING'}`);
                                  
                                  // Use advanced options for new accounts
                                  api.receivePendingWithOptions(
                                    walletAddress, 
                                    privateKey, 
                                    { 
                                      // Dynamic difficulty setting based on account status
                                      workThreshold: isNewAccount ? '0000000000000000' : 'fffffff000000000',
                                      maxRetries: 5,
                                      debug: true
                                    }
                                  ).then(result => {
                                    if (result.received) {
                                      toast({
                                        title: "Funds Received Successfully",
                                        description: `Received ${result.count} transactions using advanced method`,
                                      });
                                    } else {
                                      // Show detailed error message if available
                                      const errorMessage = result.error || 
                                        (result.processedBlocks?.length ? 
                                          `Error: ${result.processedBlocks[0].error}` : 
                                          'Could not receive funds with advanced method');
                                      
                                      toast({
                                        title: "Receive Failed",
                                        description: errorMessage,
                                        variant: "destructive"
                                      });
                                      
                                      // Display network difficulty in console for debugging
                                      if (result.debug?.accountInfo?.network_minimum) {
                                        console.log(`Network minimum difficulty: ${result.debug.accountInfo.network_minimum}`);
                                      }
                                    }
                                    refetchWalletInfo();
                                    refetchTxHistory();
                                  }).catch(err => {
                                    toast({
                                      title: "Advanced Receive Failed",
                                      description: err.message,
                                      variant: "destructive"
                                    });
                                  });
                                });
                              }}
                              disabled={!privateKey || receivePendingMutation.isPending}
                            >
                              Try Advanced Receive
                            </Button>
                            
                            <Button 
                              variant="outline"
                              size="sm" 
                              className="self-start text-amber-700 border-amber-300 bg-amber-50"
                              onClick={() => {
                                toast({
                                  title: "Important Note",
                                  description: "In some cases, pending funds can only be received once a node accepts the work. You can still view your pending transactions on a Nano block explorer while we work on improving the receive functionality.",
                                });
                                
                                window.open(`https://nanexplorer.com/nano/${walletAddress}`, '_blank');
                              }}
                            >
                              View Pending on Explorer
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-col p-4 border rounded-lg">
                        <span className="text-sm text-gray-500">Content Uploads</span>
                        <span className="text-2xl font-bold">
                          {contentStats?.uploadCount || 0}
                        </span>
                      </div>
                      
                      <div className="flex flex-col p-4 border rounded-lg">
                        <span className="text-sm text-gray-500">Total Likes Received</span>
                        <span className="text-2xl font-bold">
                          {contentStats?.totalLikes || 0}
                        </span>
                      </div>
                      
                      <div className="flex flex-col p-4 border rounded-lg bg-green-50">
                        <span className="text-sm text-green-700">Estimated Earnings</span>
                        <span className="text-3xl font-bold text-green-600">
                          {earningsData?.estimatedEarnings?.toFixed(6) || "0.000000"} XNO
                        </span>
                        <span className="text-xs text-green-700 mt-1">
                          From the current daily reward pool
                        </span>
                      </div>
                      
                      <div className="flex flex-col p-4 border rounded-lg">
                        <span className="text-sm text-gray-500 mb-2">Quick Actions</span>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <a 
                              href={`https://nanexplorer.com/nano/${walletAddress}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center"
                            >
                              <ExternalLink size={14} className="mr-1" /> 
                              View on Explorer
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Send Tab */}
            <TabsContent value="send">
              <Card>
                <CardHeader>
                  <CardTitle>Send XNO</CardTitle>
                  <CardDescription>
                    Send XNO to another wallet address
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 py-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="currentBalance">Current Balance</Label>
                      <span className="text-primary font-medium">
                        {walletInfo?.balance?.toFixed(6) || "0.000000"} XNO
                      </span>
                    </div>
                    
                    <div className="grid w-full items-center gap-2">
                      <Label htmlFor="recipientAddress">Recipient Wallet Address</Label>
                      <Input
                        id="recipientAddress"
                        placeholder="Enter recipient's XNO wallet address"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                      />
                    </div>
                    
                    <div className="grid w-full items-center gap-2">
                      <Label htmlFor="amount">Amount (XNO)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.000001"
                        min="0.000001"
                        placeholder="0.000000"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                      />
                    </div>
                    
                    {!privateKey && (
                      <div className="text-amber-600 text-sm p-2 border border-amber-200 bg-amber-50 rounded-md">
                        Private key is required to send transactions. Please click "Generate New Wallet" in the wallet connection section to create a wallet with a private key that will be automatically saved.
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleSendXno} 
                      disabled={!privateKey || !recipientAddress || !sendAmount || sendXnoMutation.isPending}
                      className="w-full mt-2"
                    >
                      {sendXnoMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" /> Send XNO</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Receive Tab */}
            <TabsContent value="receive">
              <Card>
                <CardHeader>
                  <CardTitle>Receive XNO</CardTitle>
                  <CardDescription>
                    Receive XNO to your wallet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Your Wallet Address</h3>
                      <div className="flex items-center mb-4">
                        <Input
                          value={walletAddress}
                          readOnly
                          className="mr-2 font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(walletAddress)}
                        >
                          <Copy size={16} />
                        </Button>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-4">
                        Share this address with others to receive XNO payments. 
                        The Nano network is feeless and transactions are typically confirmed within seconds.
                      </p>
                      
                      {walletInfo?.pending && walletInfo.pending.blocks.length > 0 ? (
                        <div className="p-3 border rounded-md bg-amber-50 mb-4">
                          <h3 className="font-medium text-amber-700">
                            Pending Transactions: {walletInfo.pending.blocks.length}
                          </h3>
                          <p className="text-sm text-amber-600 mb-2">
                            Total amount: {walletInfo.pending.totalAmount.toFixed(6)} XNO
                          </p>
                          <Button 
                            onClick={handleReceivePending}
                            disabled={!privateKey || receivePendingMutation.isPending}
                            size="sm"
                          >
                            {receivePendingMutation.isPending ? (
                              <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Processing...</>
                            ) : (
                              <><Download className="mr-2 h-3 w-3" /> Receive All Pending</>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="p-3 border rounded-md bg-gray-50 mb-4">
                          <p className="text-sm text-gray-600">
                            No pending transactions waiting to be received.
                          </p>
                        </div>
                      )}
                      
                      {!privateKey && (
                        <div className="text-amber-600 text-sm p-2 border border-amber-200 bg-amber-50 rounded-md">
                          Private key is required to receive pending transactions. Please click "Generate New Wallet" in the wallet connection section to create a wallet with a private key that will be automatically saved.
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center">
                      <h3 className="font-medium mb-2 self-center">Deposit QR Code</h3>
                      {walletInfo?.qrCodeUrl ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={walletInfo.qrCodeUrl} 
                            alt="Wallet QR Code" 
                            className="w-48 h-48 border p-1 rounded-md"
                          />
                          <p className="text-xs text-center text-gray-500 mt-2">
                            Scan with any Nano wallet app to deposit funds
                          </p>
                        </div>
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center border rounded-md bg-gray-50">
                          <p className="text-sm text-gray-500 text-center">
                            QR code loading...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Transactions Tab */}
            <TabsContent value="transactions">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>
                      Recent transactions for your wallet
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchTxHistory()}
                    disabled={txHistoryLoading}
                  >
                    {txHistoryLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw size={14} className="mr-1" />
                    )}
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {txHistoryLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : txHistory && txHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Type</th>
                            <th className="text-left p-2">Amount</th>
                            <th className="text-left p-2 hidden md:table-cell">Account</th>
                            <th className="text-left p-2 hidden md:table-cell">Date</th>
                            <th className="text-left p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txHistory.map((tx: Transaction) => (
                            <tr key={tx.hash} className="border-b hover:bg-gray-50 group">
                              <td className="p-2">
                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                  tx.type === 'receive' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {tx.type === 'receive' ? (
                                    <ArrowDownCircle size={12} className="mr-1" />
                                  ) : (
                                    <ArrowUpCircle size={12} className="mr-1" />
                                  )}
                                  {tx.type === 'receive' ? 'Received' : 'Sent'}
                                </span>
                              </td>
                              <td className={`p-2 font-medium ${tx.type === 'receive' ? 'text-green-600' : 'text-amber-600'}`}>
                                {tx.type === 'receive' ? '+' : '-'}{parseFloat(tx.amount).toFixed(6)} XNO
                              </td>
                              <td className="p-2 hidden md:table-cell">
                                <div className="flex items-center">
                                  <span className="text-sm truncate block max-w-[120px]" title={tx.account}>
                                    {tx.account.substring(0, 12)}...
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyToClipboard(tx.account, "Address copied")}
                                  >
                                    <Copy size={12} />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-2 text-sm hidden md:table-cell">
                                {formatDate(tx.timestamp)}
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 p-1"
                                    onClick={() => copyToClipboard(tx.hash, "Transaction hash copied")}
                                    title="Copy transaction hash"
                                  >
                                    <Copy size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 p-1"
                                    asChild
                                  >
                                    <a
                                      href={`https://nanexplorer.com/nano/block/${tx.hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="View on Nano Explorer"
                                    >
                                      <ExternalLink size={14} />
                                    </a>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CircleSlash className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No transaction history found</p>
                      <p className="text-sm mb-4">Transactions will appear here after sending or receiving XNO</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => refetchTxHistory()}
                      >
                        <RefreshCw size={14} className="mr-1" /> Refresh History
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}