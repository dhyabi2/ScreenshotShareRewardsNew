import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function Navbar() {
  const [poolAmount, setPoolAmount] = useState<number | null>(null);
  
  const { data: poolStats } = useQuery({
    queryKey: ['/api/rewards/pool-stats'],
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  useEffect(() => {
    if (poolStats?.totalPool) {
      setPoolAmount(poolStats.totalPool);
    }
  }, [poolStats]);
  
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <a className="flex-shrink-0 flex items-center">
                <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm4 9a1 1 0 110-2 1 1 0 010 2zm5-1a1 1 0 102 0 1 1 0 00-2 0z"></path>
                </svg>
                <span className="ml-2 text-xl font-semibold text-neutral-800">ScreenshotShareRewards</span>
              </a>
            </Link>
          </div>
          <div className="flex items-center">
            <div className="hidden md:block">
              <div className="flex items-center ml-4 md:ml-6">
                <span className="text-sm font-medium text-gray-500">Daily Pool:</span>
                <span className="ml-2 px-3 py-1 rounded-full text-sm font-medium bg-[#F7B801] text-white">
                  {poolAmount ? `${poolAmount} XNO` : "Loading..."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
