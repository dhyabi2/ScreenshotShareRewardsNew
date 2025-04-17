import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Content } from "@/types";
import { api } from "@/lib/api";
import { truncateAddress, generatePaymentUrl } from "@/lib/xno";
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
import { Label } from "@/components/ui/label";
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
  const [tipAmount, setTipAmount] = useState("0.05");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
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
    setIsProcessing(true);
    
    // Check for payment after 5 seconds
    setTimeout(() => {
      checkPaymentMutation.mutate();
    }, 5000);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && onOpenChange(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send XNO Tip</DialogTitle>
          <DialogDescription>
            Send a tip directly to the content creator's wallet.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center p-3 bg-gray-100 rounded-lg mb-4">
          <div className="w-12 h-12 rounded-md bg-gray-300 overflow-hidden mr-3">
            <img 
              src={content.blurredUrl} 
              alt={content.title} 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h4 className="font-medium text-sm">{content.title}</h4>
            <p className="text-xs text-gray-500 font-mono">{truncateAddress(content.walletAddress)}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tip-amount">Tip Amount (XNO)</Label>
            <div className="relative">
              <Input
                id="tip-amount"
                className="pl-12"
                type="number"
                min="0.001"
                step="0.01"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                disabled={isProcessing}
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 sm:text-sm font-medium">XNO</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="from-wallet">Your Wallet Address</Label>
            <Input
              id="from-wallet"
              className="font-mono text-xs"
              value={senderWallet}
              disabled
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendTip}
            disabled={isProcessing}
            className="flex items-center bg-[#F7B801] hover:bg-[#F7B801]/90 text-white"
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
