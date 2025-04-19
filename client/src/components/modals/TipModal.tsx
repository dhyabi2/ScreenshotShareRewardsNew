import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Content } from "@/types";
import { api } from "@/lib/api";
import { generatePaymentUrl, truncateAddress } from "@/lib/xno";
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
  senderWallet: string;
}

export default function TipModal({
  isOpen,
  onOpenChange,
  content,
  senderWallet,
}: TipModalProps) {
  const [tipAmount, setTipAmount] = useState("0.01");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  // If no sender wallet is provided, we'll still show the tip dialog
  // but display a notice that wallet verification will be needed
  
  const checkPaymentMutation = useMutation({
    mutationFn: () => {
      return api.checkPayment({
        from: senderWallet,
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
    
    // Create payment URL and open it
    const paymentUrl = generatePaymentUrl(
      content.walletAddress,
      parseFloat(tipAmount),
      `Tip for ${content.title}`
    );
    
    window.open(paymentUrl, "_blank");
    
    // Only attempt to verify payment if we have a sender wallet
    if (senderWallet) {
      setIsProcessing(true);
      
      // Check for payment after 5 seconds
      setTimeout(() => {
        checkPaymentMutation.mutate();
      }, 5000);
    } else {
      // No wallet to verify payment with, just close the dialog
      toast({
        title: "Tip sent",
        description: "Thank you for your tip! (No wallet verification available)",
      });
      onOpenChange(false);
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
          
          {!senderWallet && (
            <div className="mt-4 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
              <p>No wallet connected. Your tip will still be processed, but payment verification won't be available.</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            onClick={handleSendTip}
            disabled={isProcessing}
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
