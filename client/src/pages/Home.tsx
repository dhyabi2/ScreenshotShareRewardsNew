import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InfoBanner from "@/components/InfoBanner";
import UploadForm from "@/components/UploadForm";
import StatsCard from "@/components/StatsCard";
import ContentGallery from "@/components/ContentGallery";
import { api } from "@/lib/api";

export default function Home() {
  const [userWallet, setUserWallet] = useState<string | undefined>(undefined);
  
  const handleFormSubmit = (wallet: string) => {
    setUserWallet(wallet);
  };
  
  // Pre-fetch daily pool stats to use across components
  useQuery({
    queryKey: ['/api/rewards/pool-stats'],
    staleTime: 60000, // 1 minute
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <InfoBanner 
        title="How it works" 
        message="Upload screenshots or short videos (max 20s), earn rewards from the daily pool, and receive XNO tips from viewers. No account needed—just an XNO wallet!" 
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Upload and stats */}
        <div className="lg:col-span-1 space-y-6">
          <UploadForm />
          <StatsCard walletAddress={userWallet} />
        </div>
        
        {/* Right column: Gallery */}
        <div className="lg:col-span-2">
          <ContentGallery />
        </div>
      </div>
    </main>
  );
}
