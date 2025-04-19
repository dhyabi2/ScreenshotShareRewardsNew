import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { clientXnoService } from "@/lib/clientXnoService";
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
import { Slider } from "@/components/ui/slider";
import { formatXNO, truncateAddress } from "@/lib/utils";
import { Content } from "@shared/schema";
import { Loader2, Info, Shield } from "lucide-react";

interface UpvoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content;
  walletAddress: string;
  privateKey: string;
}

export default function UpvoteModal({
  isOpen,
  onClose,
  content,
  walletAddress,
  privateKey
}: UpvoteModalProps) {
  const [amount, setAmount] = useState(0.01); // Default 0.01 XNO
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Calculate 80/20 split
  const creatorAmount = amount * 0.8;
  const poolAmount = amount * 0.2;
  
  // Use client-side processing for upvotes (80/20 split between creator and pool)
  const upvoteMutation = useMutation({
    mutationFn: () => clientXnoService.processUpvote(
      walletAddress,
      privateKey,
      content.walletAddress,
      content.id,
      amount.toString() // Convert to string to match the expected parameter type
    ),
    onSuccess: (data) => {
      toast({
        title: "Upvote successful!",
        description: `Your payment of ${amount} XNO was processed with ${data.creatorAmount} XNO to creator and ${data.poolAmount} XNO to reward pool.`,
      });
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content', content.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/transactions'] });
      
      // Close the modal
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Upvote failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });
  
  const handleUpvote = () => {
    setIsProcessing(true);
    
    // Show security message
    toast({
      title: "Processing transaction securely",
      description: "Your private key will be processed locally and never sent to the server."
    });
    
    // Process the upvote client-side
    upvoteMutation.mutate();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upvote Content</DialogTitle>
          <DialogDescription>
            Support this content with XNO following the Self-Sustained Model
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-primary bg-opacity-10 p-4 rounded-lg space-y-2">
          <div className="flex items-center">
            <Info className="h-5 w-5 mr-2 text-primary" />
            <h3 className="font-medium text-sm">How the Self-Sustained Model works:</h3>
          </div>
          <ul className="text-sm text-gray-600 space-y-1 pl-7 list-disc">
            <li>80% of your upvote goes directly to the content creator</li>
            <li>20% goes to the platform reward pool</li>
            <li>Content creators earn additional rewards from the pool</li>
          </ul>
        </div>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">
                Content
              </label>
              <span className="text-xs text-gray-500">{truncateAddress(content.walletAddress)}</span>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <p className="font-medium text-sm truncate">{content.title}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Upvote Amount: {formatXNO(amount)} XNO
            </label>
            <Slider
              value={[amount]}
              min={0.01}
              max={1}
              step={0.01}
              onValueChange={(value) => setAmount(value[0])}
              disabled={isProcessing}
            />
            <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
              <span>0.01 XNO</span>
              <span className="text-center">0.5 XNO</span>
              <span className="text-right">1 XNO</span>
            </div>
          </div>
          
          <div className="rounded-lg border border-gray-200 divide-y">
            <div className="p-3 flex justify-between items-center">
              <span className="text-sm">Creator receives (80%)</span>
              <span className="font-medium">{formatXNO(creatorAmount)} XNO</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-sm">Reward pool (20%)</span>
              <span className="font-medium">{formatXNO(poolAmount)} XNO</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
            <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-medium">Enhanced security:</p>
              <p>All transactions are processed client-side. Your private key never leaves your browser.</p>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 italic">
            Note: Transaction may take a few seconds to process on the blockchain
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleUpvote}
            disabled={isProcessing || amount <= 0}
            className="bg-primary"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Upvote & Pay"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}