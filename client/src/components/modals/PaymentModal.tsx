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
import { Loader2, LockOpen } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface PaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  content: Content;
  onSuccess?: () => void;
}

export default function PaymentModal({
  isOpen,
  onOpenChange,
  content,
  onSuccess,
}: PaymentModalProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  const checkPaymentMutation = useMutation({
    mutationFn: () => {
      return api.checkPayment({
        from: walletAddress,
        to: content.walletAddress,
        amount: content.price,
        contentId: content.id
      });
    },
    onSuccess: (data) => {
      if (data.paid) {
        toast({
          title: "Payment successful!",
          description: "You now have full access to this content.",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/content'] });
        if (onSuccess) onSuccess();
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
        description: "There was an error verifying your payment.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });
  
  const handleUnlock = () => {
    if (!walletAddress) {
      toast({
        title: "Wallet address required",
        description: "Please enter your XNO wallet address.",
        variant: "destructive",
      });
      return;
    }
    
    // Create payment URL and open it
    const paymentUrl = generatePaymentUrl(
      content.walletAddress,
      content.price,
      `Unlock ${content.title}`
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
          <DialogTitle>Unlock Content</DialogTitle>
          <DialogDescription>
            Pay {content.price} XNO to get full access to this content.
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
        
        <div className="space-y-2">
          <Label htmlFor="pay-amount">Amount to Pay</Label>
          <div className="relative">
            <Input
              id="pay-amount"
              className="pl-12"
              type="number"
              value={content.price}
              disabled
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
            placeholder="nano_1abc..."
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            disabled={isProcessing}
          />
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
            onClick={handleUnlock}
            disabled={isProcessing || !walletAddress}
            className="flex items-center"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <LockOpen className="h-4 w-4 mr-2" />
                Unlock ({content.price} XNO)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
