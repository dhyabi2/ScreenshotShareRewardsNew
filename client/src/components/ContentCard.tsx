import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Heart, DollarSign, Share2, Flag, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Content } from "@/types";
import { truncateAddress } from "@/lib/xno";
import { formatXNO } from "@/lib/utils";
import { api } from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { queryClient } from "@/lib/queryClient";
import WalletVerificationModal from "./modals/WalletVerificationModal";
import TipModal from "./modals/TipModal";
import PaymentModal from "./modals/PaymentModal";
import UpvoteModal from "./modals/UpvoteModal";

interface ContentCardProps {
  content: Content;
  onUnlock?: (contentId: string) => void;
}

export default function ContentCard({ content, onUnlock }: ContentCardProps) {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isUpvoteModalOpen, setIsUpvoteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { toast } = useToast();
  const { walletAddress, privateKey, isConnected, connectWallet } = useWallet();
  
  const likeMutation = useMutation({
    mutationFn: (walletAddress: string) => api.likeContent(content.id, walletAddress),
    onSuccess: () => {
      toast({
        title: "Content liked!",
        description: "Your like has been registered.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to like content",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const reportMutation = useMutation({
    mutationFn: () => api.reportContent(content.id, "Inappropriate content"),
    onSuccess: () => {
      toast({
        title: "Content reported",
        description: "Thank you for flagging this content. It will be reviewed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
    },
  });
  
  // Legacy like mutation - will be replaced by upvote
  const handleLike = () => {
    if (isConnected && walletAddress) {
      likeMutation.mutate(walletAddress);
    } else {
      setIsWalletModalOpen(true);
    }
  };
  
  // Handle upvote with real payment (80/20 split to creator/pool)
  const handleUpvote = () => {
    if (isConnected && walletAddress && privateKey) {
      setIsUpvoteModalOpen(true);
    } else {
      setIsWalletModalOpen(true);
    }
  };
  
  const handleTip = () => {
    // Always open tip modal regardless of wallet state - this simplifies the user flow
    // The TipModal component is already simplified with default 0.01 XNO amount
    setIsTipModalOpen(true);
  };
  
  const handleUnlock = () => {
    if (content.price > 0) {
      setIsPaymentModalOpen(true);
    } else if (onUnlock) {
      onUnlock(content.id);
    }
  };
  
  const handleWalletVerified = (address: string, key?: string) => {
    // Connect the wallet using our global context
    connectWallet(address, key);
    setIsWalletModalOpen(false);
  };
  
  const handleReport = () => {
    setIsReportModalOpen(true);
  };
  
  const confirmReport = () => {
    reportMutation.mutate();
    setIsReportModalOpen(false);
  };
  
  // Determine content status and display
  const isFlagged = content.status === "flagged";
  const isBlurred = content.price > 0 && content.isPaid === false;
  
  return (
    <>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="relative aspect-w-16 aspect-h-9">
          {/* Content preview */}
          {content.type === "video" ? (
            <>
              <img 
                src={isBlurred ? content.blurredUrl : content.originalUrl} 
                alt={content.title}
                className={`w-full h-full object-cover ${isBlurred ? "blur-preview" : ""}`}
              />
              {!isBlurred && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black bg-opacity-50 rounded-full p-3">
                    <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
              )}
              {content.durationSeconds && (
                <div className="absolute bottom-2 right-2">
                  <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                    0:{content.durationSeconds.toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <img 
              src={isBlurred ? content.blurredUrl : content.originalUrl} 
              alt={content.title}
              className={`w-full h-full object-cover ${isBlurred ? "blur-preview" : ""}`}
            />
          )}
          
          {/* Overlay for paid content */}
          {isBlurred && (
            <div className="absolute inset-0 image-overlay flex flex-col items-center justify-center text-white bg-black bg-opacity-30">
              <div className="text-center">
                <div className="text-lg font-bold mb-1">{content.price} XNO</div>
                <Button 
                  onClick={handleUnlock}
                  variant="secondary" 
                  className="mt-2 bg-white text-primary hover:bg-gray-100 font-medium py-1 px-4 rounded-full text-sm"
                >
                  Unlock
                </Button>
              </div>
            </div>
          )}
          
          {/* Flagged content overlay */}
          {isFlagged && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500 bg-opacity-30">
              <svg className="h-10 w-10 text-red-600 mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
              <span className="text-white font-medium">Content Under Review</span>
            </div>
          )}
          
          {/* Content type badge */}
          <div className="absolute top-2 right-2">
            {content.type === "video" ? (
              <span className="bg-[#F7B801] text-white text-xs px-2 py-1 rounded-full">Video</span>
            ) : content.price > 0 ? (
              <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">Paid</span>
            ) : (
              <span className="bg-[#16DB93] text-white text-xs px-2 py-1 rounded-full">Free</span>
            )}
          </div>
        </div>
        
        <div className="p-3">
          <div className="flex justify-between items-start">
            <Link href={`/content/${content.id}`} className="font-medium text-sm truncate hover:text-primary transition-colors">
              {content.title}
            </Link>
            <div className="bg-gradient-to-r from-[#F7B801] to-[#F59E0B] text-white text-xs px-2 py-0.5 rounded-full">
              +{(Math.random() * 0.5).toFixed(2)} XNO
            </div>
          </div>
          
          <div className="flex items-center mt-2 text-xs text-gray-500">
            <span className="font-mono truncate">{truncateAddress(content.walletAddress)}</span>
            <button className="ml-1 text-gray-400 hover:text-gray-600" onClick={() => navigator.clipboard.writeText(content.walletAddress)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
          </div>
          
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center text-gray-500 hover:text-primary p-0 h-auto"
                onClick={handleUpvote}
                disabled={isFlagged}
              >
                <Heart className="h-5 w-5 mr-1" />
                <span className="text-sm">{content.likeCount}</span>
                <span className="text-[10px] ml-1 text-primary font-semibold">(+XNO)</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="ml-3 flex items-center text-gray-500 hover:text-[#F7B801] p-0 h-auto"
                onClick={handleTip}
                disabled={isFlagged}
              >
                <DollarSign className="h-5 w-5 mr-1" />
                <span className="text-sm">Tip</span>
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 p-0 h-auto">
                <Share2 className="h-5 w-5" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 p-0 h-auto">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleReport}
                    className="text-red-500 flex items-center cursor-pointer"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report Content
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <WalletVerificationModal 
        isOpen={isWalletModalOpen} 
        onOpenChange={setIsWalletModalOpen}
        onWalletVerified={handleWalletVerified}
      />
      
      <TipModal
        isOpen={isTipModalOpen}
        onOpenChange={setIsTipModalOpen}
        content={content}
        senderWallet={walletAddress}
      />
      
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        content={content}
        onSuccess={onUnlock ? () => onUnlock(content.id) : undefined}
      />
      
      <AlertDialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report Content</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to report this content? Reported content will be reviewed by moderators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReport} className="bg-red-500 hover:bg-red-600">
              Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Upvote Modal for the 80/20 paid upvote system */}
      {privateKey && <UpvoteModal
        isOpen={isUpvoteModalOpen}
        onClose={() => setIsUpvoteModalOpen(false)}
        content={content}
        walletAddress={walletAddress}
        privateKey={privateKey}
      />}
    </>
  );
}
