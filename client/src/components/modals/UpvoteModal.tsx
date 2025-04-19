import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { formatXNO } from "@/lib/utils";
import { Content } from "@/types";

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
  privateKey,
}: UpvoteModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(0.01); // Default upvote amount

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      return api.processUpvote(
        walletAddress,
        privateKey,
        content.walletAddress,
        Number(content.id),
        amount
      );
    },
    onSuccess: (data) => {
      toast({
        title: "Upvote successful!",
        description: `${formatXNO(data.creatorAmount)} XNO sent to creator and ${formatXNO(data.poolAmount)} XNO contributed to reward pool.`,
      });
      
      // Invalidate queries to refresh content data
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
      queryClient.invalidateQueries({ queryKey: [`/api/content/${content.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/pool-stats'] });
      
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Upvote failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpvote = async () => {
    upvoteMutation.mutate();
  };

  // Calculate the 80/20 split for display
  const creatorAmount = amount * 0.8;
  const poolAmount = amount * 0.2;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upvote this content</DialogTitle>
          <DialogDescription>
            Your upvote payment will be split with 80% going to the creator and 20% to the community reward pool.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount (XNO)
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              step={0.01}
              min={0.01}
              max={10}
              className="col-span-3"
            />
          </div>
          
          <div className="px-3">
            <Slider
              defaultValue={[0.01]}
              max={0.1}
              step={0.01}
              value={[amount]}
              onValueChange={(value) => setAmount(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.01</span>
              <span>0.05</span>
              <span>0.1</span>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg mt-2">
            <div className="text-sm">
              <div className="flex justify-between py-1">
                <span>Creator receives (80%):</span>
                <span className="font-semibold">{formatXNO(creatorAmount)} XNO</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Reward pool (20%):</span>
                <span className="font-semibold">{formatXNO(poolAmount)} XNO</span>
              </div>
              <div className="flex justify-between py-1 border-t mt-1 pt-2">
                <span className="font-medium">Total:</span>
                <span className="font-semibold">{formatXNO(amount)} XNO</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={upvoteMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpvote} 
            disabled={upvoteMutation.isPending}
            className="bg-gradient-to-r from-[#F7B801] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#F7B801]"
          >
            {upvoteMutation.isPending ? "Processing..." : "Upvote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}