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
  onWalletVerified: (address: string, privateKey?: string) => void;
}

export default function WalletVerificationModal({ 
  isOpen, 
  onOpenChange,
  onWalletVerified
}: WalletVerificationModalProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [importMode, setImportMode] = useState(false);
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
  
  // Import wallet from private key
  const importWalletMutation = useMutation({
    mutationFn: (key: string) => api.importWallet(key),
    onSuccess: (data) => {
      if (data.address) {
        setWalletAddress(data.address);
        setWalletInfo({ balance: data.balance, valid: true });
        
        // Store the private key in localStorage for persistence
        if (data.address && privateKey) {
          localStorage.setItem(`nano_wallet_${data.address}`, privateKey);
        }
        
        toast({
          title: "Wallet imported",
          description: "Your XNO wallet has been imported successfully.",
        });
      } else {
        toast({
          title: "Import failed",
          description: "Could not import wallet from the provided private key.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleImportWallet = () => {
    if (!privateKey || privateKey.length < 64) {
      toast({
        title: "Invalid private key",
        description: "Please enter a valid XNO private key (64+ characters).",
        variant: "destructive",
      });
      return;
    }
    
    importWalletMutation.mutate(privateKey);
  };
  
  const handleConfirm = () => {
    if (walletInfo?.valid) {
      // Pass private key to parent component if available
      onWalletVerified(walletAddress, privateKey || undefined);
      
      // Store the private key in localStorage for persistence
      if (walletAddress && privateKey) {
        localStorage.setItem(`nano_wallet_${walletAddress}`, privateKey);
      }
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
        
        <div className="flex mb-4">
          <div 
            className={`flex-1 py-2 px-4 text-center font-medium cursor-pointer ${!importMode ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => setImportMode(false)}
          >
            Verify Address
          </div>
          <div 
            className={`flex-1 py-2 px-4 text-center font-medium cursor-pointer ${importMode ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => setImportMode(true)}
          >
            Import Private Key
          </div>
        </div>
        
        <div className="bg-primary bg-opacity-10 p-3 rounded-lg mb-4">
          <p className="text-sm text-gray-600">
            {importMode 
              ? "Import your wallet by entering your private key. This will be securely stored in your browser's local storage."
              : "Enter your XNO wallet address below to verify and check its balance."
            }
          </p>
        </div>
        
        <div className="space-y-4">
          {importMode ? (
            <div className="space-y-2">
              <label htmlFor="private-key" className="text-sm font-medium flex justify-between">
                <span>Private Key</span>
                <button 
                  type="button" 
                  className="text-xs text-gray-500 hover:text-primary"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? "Hide" : "Show"}
                </button>
              </label>
              <Input
                id="private-key"
                className="font-mono text-sm"
                type={showPrivateKey ? "text" : "password"}
                placeholder="Enter your private key"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={handleImportWallet}
                disabled={importWalletMutation.isPending || !privateKey}
                className="w-full mt-2"
              >
                {importWalletMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Wallet"
                )}
              </Button>
            </div>
          ) : (
            <div>
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
                className="w-full mt-2"
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
              
              {walletInfo?.valid && (
                <div className="mt-4">
                  <div className="text-sm mb-1 text-gray-600">For full wallet functionality (including upvoting):</div>
                  <div className="space-y-2">
                    <label htmlFor="private-key-optional" className="text-sm font-medium flex justify-between">
                      <span>Private Key (Optional)</span>
                      <button 
                        type="button" 
                        className="text-xs text-gray-500 hover:text-primary"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                      >
                        {showPrivateKey ? "Hide" : "Show"}
                      </button>
                    </label>
                    <Input
                      id="private-key-optional"
                      className="font-mono text-sm"
                      type={showPrivateKey ? "text" : "password"}
                      placeholder="Enter your private key (for full functionality)"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
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
