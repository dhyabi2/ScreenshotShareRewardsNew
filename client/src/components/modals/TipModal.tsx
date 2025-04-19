import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Content } from "@/types";
import { api } from "@/lib/api";
import { generatePaymentUrl } from "@/lib/xno";
import {
  Dialog,
  DialogContent,
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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Tip Creator</DialogTitle>
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
