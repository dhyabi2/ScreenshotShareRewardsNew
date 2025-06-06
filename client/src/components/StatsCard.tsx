import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import { DailyPoolStats } from "@/types";
import { formatXNO } from "@/lib/xno";

interface StatsCardProps {
  walletAddress?: string;
}

export default function StatsCard({ walletAddress }: StatsCardProps) {
  const [earnings, setEarnings] = useState<number | null>(null);
  
  const { data: poolStats, isLoading: isLoadingStats } = useQuery<DailyPoolStats>({
    queryKey: ['/api/rewards/pool-stats'],
    refetchInterval: 60000, // Refresh every minute
  });
  
  const { data: earningsData, isLoading: isLoadingEarnings } = useQuery({
    queryKey: ['/api/rewards/estimated-earnings', walletAddress],
    enabled: !!walletAddress,
    queryFn: () => walletAddress ? api.getUserEstimatedEarnings(walletAddress) : Promise.resolve({ estimatedEarnings: 0 }),
  });
  
  useEffect(() => {
    if (earningsData) {
      setEarnings(earningsData.estimatedEarnings);
    }
  }, [earningsData]);
  
  // Create default pool stats if loading or no data available
  const defaultPoolStats: DailyPoolStats = {
    totalPool: 0,
    uploadPool: 0,
    likePool: 0,
    uploadPoolPercentage: 50,
    likePoolPercentage: 50,
    poolAddress: poolStats?.poolAddress || '',
  }
  
  // Use actual pool stats or default to 0 values
  const stats = poolStats || defaultPoolStats;
  const uploadPoolPercentage = stats.uploadPoolPercentage;
  const likePoolPercentage = stats.likePoolPercentage;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Rewards</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Upload Rewards</span>
              <span className="font-medium">{formatXNO(stats.uploadPool)} ({uploadPoolPercentage}%)</span>
            </div>
            <Progress value={uploadPoolPercentage} className="h-2 mt-1" />
          </div>
          
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Like-based Rewards</span>
              <span className="font-medium">{formatXNO(stats.likePool)} ({likePoolPercentage}%)</span>
            </div>
            <Progress value={likePoolPercentage} className="h-2 mt-1" />
          </div>
          
          {stats.poolAddress && (
            <div className="mt-2 p-3 border border-dashed rounded-lg text-xs">
              <h3 className="font-medium text-gray-500 mb-1">
                Pool Wallet (Public)
              </h3>
              <p className="break-all text-xs">
                {stats.poolAddress}
              </p>
              <div className="mt-1">
                <a 
                  href={`https://nanexplorer.com/nano/${stats.poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View on Nanexplorer →
                </a>
              </div>
            </div>
          )}
          
          {walletAddress && (
            <div className="p-4 bg-neutral-100 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Your Estimated Earnings</h3>
              <div className="flex items-center">
                <PlayCircle className="h-6 w-6 text-[#F7B801] mr-2" />
                {isLoadingEarnings ? (
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <span className="text-lg font-semibold text-gray-800">
                    {earnings !== null ? formatXNO(earnings) : "0 XNO"}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Based on your content performance</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
