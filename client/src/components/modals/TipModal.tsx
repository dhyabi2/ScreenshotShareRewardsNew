import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Content } from "@/types";
import { api } from "@/lib/api";
import { truncateAddress, formatXNO } from "@/lib/xno";
import { useWallet } from "@/contexts/WalletContext";
import { clientXnoService } from "@/lib/clientXnoService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign } from "lucide-react";

interface TipModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  content: Content;
  senderWallet?: string; // Make this optional since we'll use the global wallet context
}

export default function TipModal({
  isOpen,
  onOpenChange,
  content,
  senderWallet, // We'll now use this as a fallback only
}: TipModalProps) {
  const [tipAmount, setTipAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { walletAddress, isConnected, privateKey } = useWallet();
  
  // Use the global wallet context if available, otherwise fall back to the provided senderWallet
  const activeWallet = isConnected && walletAddress ? walletAddress : senderWallet;
  
  // Fetch wallet balance
  const { data: walletInfo, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['wallet', 'info', activeWallet],
    queryFn: () => api.getWalletInfo(activeWallet || ''),
    enabled: !!activeWallet,
    refetchInterval: 10000, // Refresh every 10 seconds to get updated balance
  });
  
  // Send tip mutation - uses client-side XNO transaction processing (private key never leaves browser)
  const sendTipMutation = useMutation({
    mutationFn: (params: { 
      fromAddress: string,
      privateKey: string,
      toAddress: string,
      amount: string,
      contentId: number
    }) => {
      // Use the client-side service to process the transaction
      return clientXnoService.sendTip({
        fromAddress: params.fromAddress,
        privateKey: params.privateKey,
        toAddress: params.toAddress,
        amount: params.amount,
        contentId: params.contentId
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Tip sent successfully!",
        description: `You have tipped ${tipAmount} XNO to the creator. Transaction hash: ${data.hash?.substring(0, 10)}...`,
      });
      setIsProcessing(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending tip",
        description: error.message || "Failed to send XNO tip. Please check your wallet balance.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });
  
  // The legacy payment verification after user opens payment URL
  const checkPaymentMutation = useMutation({
    mutationFn: () => {
      return api.checkPayment({
        from: activeWallet!,
        to: content.walletAddress,
        amount: parseFloat(tipAmount),
        contentId: content.id
      });
    },
    onSuccess: (data) => {
      if (data.paid) {
        toast({
          title: "Tip sent successfully!",
          description: `You have tipped ${tipAmount} XNO to the creator.`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Payment not detected",
          description: "Please make sure you've sent the correct amount.",
          variant: "destructive",
        });
      }
      setIsProcessing(false);
    },
    onError: () => {
      toast({
        title: "Error checking payment",
        description: "There was an error verifying your tip.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });
  
  const handleSendTip = () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid tip amount.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if we have sufficient balance
    if (walletInfo && parseFloat(tipAmount) > walletInfo.balance) {
      toast({
        title: "Insufficient balance",
        description: `Your wallet balance (${formatXNO(walletInfo.balance)} XNO) is less than the tip amount.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    // If we have both wallet address and private key, use client-side processing
    if (activeWallet && privateKey) {
      // Show toast that transaction will be processed securely
      toast({
        title: "Processing transaction securely",
        description: "Your private key will be processed locally and never sent to the server.",
      });
      
      // Use client-side transaction processing (private key never leaves browser)
      sendTipMutation.mutate({
        fromAddress: activeWallet,
        privateKey: privateKey,
        toAddress: content.walletAddress,
        amount: tipAmount,
        contentId: content.id
      });
    } else {
      // No wallet or private key available, show message
      toast({
        title: "Wallet not fully connected",
        description: "Please connect your wallet with private key to send tips directly.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && onOpenChange(open)}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Tip Creator</DialogTitle>
          <DialogDescription>
            Tip {truncateAddress(content.walletAddress)} with XNO
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          <div className="flex items-center">
            <div className="relative w-full">
              <Input
                id="tip-amount"
                className="pl-10 text-lg"
                type="number"
                min="0.001"
                step="0.01"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                disabled={isProcessing}
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 font-medium">XNO</span>
              </div>
            </div>
          </div>
          
          {(!activeWallet || !privateKey) && (
            <div className="mt-4 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
              {!activeWallet ? (
                <p>No wallet connected. Please connect your wallet first to send tips.</p>
              ) : !privateKey ? (
                <p>Wallet connected but missing private key. Please reconnect your wallet with a private key to send tips.</p>
              ) : null}
            </div>
          )}
          
          {activeWallet && privateKey && (
            <div className="mt-4 p-2 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
              <p>Ready to send tip from <strong>{truncateAddress(activeWallet)}</strong></p>
              {isLoadingWallet ? (
                <p className="mt-1">Loading wallet balance...</p>
              ) : walletInfo ? (
                <p className="mt-1">Available balance: <strong>{formatXNO(walletInfo.balance)} XNO</strong></p>
              ) : null}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col gap-2">
          {(!activeWallet || !privateKey) && (
            <Button
              onClick={() => {
                // Close tip modal and let user connect wallet
                onOpenChange(false);
                // Could add a wallet connect call here if we have a shared wallet connect modal
              }}
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"
            >
              Connect Wallet First
            </Button>
          )}
          
          <Button
            onClick={handleSendTip}
            disabled={isProcessing || !activeWallet || !privateKey}
            className="w-full flex items-center justify-center bg-[#F7B801] hover:bg-[#F7B801]/90 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="h-5 w-5 mr-1" />
                Send Tip
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
