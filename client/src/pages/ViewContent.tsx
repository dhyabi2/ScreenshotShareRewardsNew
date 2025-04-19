import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Content } from "@/types";
import { api } from "@/lib/api";
import { formatXNO, truncateAddress } from "@/lib/xno";
import { 
  ArrowLeft, 
  ExternalLink, 
  Share2, 
  Clipboard, 
  Calendar, 
  Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ContentCard from "@/components/ContentGallery";
import { useToast } from "@/hooks/use-toast";

export default function ViewContent() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  const { data: content, isLoading, isError } = useQuery<Content>({
    queryKey: [`/api/content/${id}`],
    queryFn: () => api.getContent(id),
  });
  
  useEffect(() => {
    // If content is free or already paid, unlock it
    if (content && (content.price === 0 || content.isPaid)) {
      setIsUnlocked(true);
    }
  }, [content]);
  
  const handleUnlock = () => {
    setIsUnlocked(true);
  };
  
  const handleBack = () => {
    navigate("/");
  };
  
  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: message,
      });
    });
  };
  
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to gallery
        </Button>
        
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full rounded-lg mb-4" />
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <div className="flex space-x-4">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isError || !content) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to gallery
        </Button>
        
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-500 mb-2">Content Not Found</h2>
            <p className="text-gray-600 mb-4">The content you're looking for might have been removed or doesn't exist.</p>
            <Button onClick={handleBack}>Return to Gallery</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const shareUrl = window.location.href;
  const contentDate = new Date(content.createdAt).toLocaleDateString();
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Button variant="ghost" onClick={handleBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to gallery
      </Button>
      
      <Card>
        <CardContent className="p-6">
          {/* Content display */}
          <div className="mb-6">
            {content.type === "video" ? (
              isUnlocked ? (
                <video 
                  controls
                  className="w-full rounded-lg max-h-[600px] object-contain bg-black"
                  src={content.originalUrl}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="relative">
                  <img 
                    src={content.blurredUrl} 
                    alt={content.title}
                    className="w-full rounded-lg blur-preview max-h-[600px] object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                    <div className="text-center text-white">
                      <div className="text-xl font-bold mb-2">{formatXNO(content.price)}</div>
                      <Button 
                        onClick={() => {
                          const contentCard = document.getElementById(`content-${content.id}`);
                          if (contentCard) {
                            const unlockButton = contentCard.querySelector('button:contains("Unlock")');
                            if (unlockButton) {
                              (unlockButton as HTMLButtonElement).click();
                            }
                          }
                        }}
                        variant="secondary"
                        className="bg-white text-primary hover:bg-gray-100"
                      >
                        Unlock Content
                      </Button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              isUnlocked ? (
                <img 
                  src={content.originalUrl} 
                  alt={content.title}
                  className="w-full rounded-lg max-h-[600px] object-contain"
                />
              ) : (
                <div className="relative">
                  <img 
                    src={content.blurredUrl} 
                    alt={content.title}
                    className="w-full rounded-lg blur-preview max-h-[600px] object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                    <div className="text-center text-white">
                      <div className="text-xl font-bold mb-2">{formatXNO(content.price)}</div>
                      <Button 
                        onClick={() => {
                          const contentElement = document.getElementById(`content-${content.id}`);
                          if (contentElement) {
                            // Find unlock button and click it
                            const unlockButton = contentElement.querySelector('button:contains("Unlock")') as HTMLButtonElement;
                            if (unlockButton) unlockButton.click();
                          }
                        }}
                        variant="secondary"
                        className="bg-white text-primary hover:bg-gray-100"
                      >
                        Unlock Content
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
          
          {/* Content metadata */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">{content.title}</h1>
            
            <div className="flex flex-wrap items-center gap-y-2 text-sm text-gray-500 mb-4">
              <div className="flex items-center mr-4">
                <Calendar className="h-4 w-4 mr-1" />
                <span>{contentDate}</span>
              </div>
              
              <div className="flex items-center mr-4">
                <Heart className="h-4 w-4 mr-1" />
                <span>{content.likeCount} likes</span>
              </div>
              
              {content.type === "video" && content.durationSeconds && (
                <div className="flex items-center mr-4">
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    0:{content.durationSeconds.toString().padStart(2, '0')}
                  </span>
                </div>
              )}
              
              <div className="flex items-center">
                <span className={`px-2 py-0.5 rounded ${
                  content.price > 0 
                    ? "bg-primary/10 text-primary" 
                    : "bg-green-100 text-green-800"
                }`}>
                  {content.price > 0 ? `${formatXNO(content.price)}` : "Free"}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="font-mono text-sm mr-2">{truncateAddress(content.walletAddress, 10, 10)}</span>
                  <button 
                    onClick={() => copyToClipboard(content.walletAddress, "Wallet address copied to clipboard!")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Clipboard className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(shareUrl, "Link copied to clipboard!")}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`https://nanexplorer.com/nano/${content.walletAddress}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Verify Wallet
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Render the ContentCard component to access its functionality */}
          <div id={`content-${content.id}`} className="hidden">
            <ContentCard 
              content={content}
              onUnlock={handleUnlock}
            />
          </div>
          
          {/* Action buttons visible on the details page */}
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => {
                const likeButton = document.querySelector(`#content-${content.id} button:has([class*="lucide-heart"])`) as HTMLButtonElement;
                if (likeButton) likeButton.click();
              }}
              className="flex items-center"
            >
              <Heart className="h-4 w-4 mr-2" />
              Like Content
            </Button>
            
            <Button 
              onClick={() => {
                const tipButton = document.querySelector(`#content-${content.id} button:contains("Tip")`) as HTMLButtonElement;
                if (tipButton) tipButton.click();
              }}
              className="flex items-center bg-[#F7B801] hover:bg-[#F7B801]/90 text-white"
            >
              <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Send Tip
            </Button>
            
            {!isUnlocked && content.price > 0 && (
              <Button 
                onClick={() => {
                  const unlockButton = document.querySelector(`#content-${content.id} button:contains("Unlock")`) as HTMLButtonElement;
                  if (unlockButton) unlockButton.click();
                }}
                variant="secondary"
              >
                Unlock ({formatXNO(content.price)})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
