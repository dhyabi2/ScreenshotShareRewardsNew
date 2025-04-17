import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isValidXNOAddress } from "@/lib/xno";
import { Loader2 } from "lucide-react";

interface WalletVerificationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onWalletVerified: (address: string) => void;
}

export default function WalletVerificationModal({ 
  isOpen, 
  onOpenChange,
  onWalletVerified
}: WalletVerificationModalProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletInfo, setWalletInfo] = useState<{ balance: number; valid: boolean } | null>(null);
  const { toast } = useToast();
  
  const verifyMutation = useMutation({
    mutationFn: (address: string) => api.verifyWallet(address),
    onSuccess: (data) => {
      setWalletInfo(data);
      if (data.valid) {
        toast({
          title: "Wallet verified",
          description: "Your XNO wallet has been verified successfully.",
        });
      } else {
        toast({
          title: "Invalid wallet",
          description: "The wallet address could not be verified.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleVerify = () => {
    if (!isValidXNOAddress(walletAddress)) {
      toast({
        title: "Invalid wallet format",
        description: "Please enter a valid XNO wallet address.",
        variant: "destructive",
      });
      return;
    }
    
    verifyMutation.mutate(walletAddress);
  };
  
  const handleConfirm = () => {
    if (walletInfo?.valid) {
      onWalletVerified(walletAddress);
    } else {
      toast({
        title: "Invalid wallet",
        description: "Please verify your wallet address first.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify XNO Wallet</DialogTitle>
          <DialogDescription>
            To receive rewards and tips, please verify your XNO wallet address.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-primary bg-opacity-10 p-3 rounded-lg mb-4">
          <p className="text-sm text-gray-600">
            Enter your XNO wallet address below to verify and check its balance.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="wallet-address" className="text-sm font-medium">
              Wallet Address
            </label>
            <Input
              id="wallet-address"
              className="font-mono text-sm"
              placeholder="nano_1abc123..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            />
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleVerify}
            disabled={verifyMutation.isPending || !walletAddress}
            className="w-full"
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Wallet"
            )}
          </Button>
          
          {walletInfo && (
            <>
              <div className="font-mono text-sm p-3 bg-gray-100 rounded-lg break-all">
                {walletAddress}
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg">
                <span className="text-sm text-gray-600">Current Balance:</span>
                <span className="font-semibold">{walletInfo.balance.toFixed(4)} XNO</span>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!walletInfo?.valid}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
