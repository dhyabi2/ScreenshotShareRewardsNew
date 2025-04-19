import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertCircle, Wallet, Send, BarChart3, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PoolStats {
  totalPool: number;
  uploadPoolPercentage: number;
  likePoolPercentage: number;
  dailyDistribution: number;
  poolAddress?: string;
}

export default function PoolWalletManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadPercentage, setUploadPercentage] = useState(70);
  const [likePercentage, setLikePercentage] = useState(30);
  const [distributionPercentage, setDistributionPercentage] = useState(5);
  const [showConfigConfirm, setShowConfigConfirm] = useState(false);
  
  // Query for pool stats
  const { 
    data: poolStats, 
    isLoading: isLoadingPoolStats,
    error: poolStatsError
  } = useQuery<PoolStats>({ 
    queryKey: ['/api/rewards/pool-stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Mutation to update pool configuration
  const updatePoolConfigMutation = useMutation({
    mutationFn: async (config: {
      uploadPoolPercentage: number;
      likePoolPercentage: number;
      dailyDistribution: number;
    }) => {
      return await apiRequest('/api/rewards/update-pool-config', {
        method: 'POST',
        body: config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/pool-stats'] });
      toast({
        title: "Pool configuration updated",
        description: "The reward pool settings have been updated successfully.",
      });
      setShowConfigConfirm(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update pool configuration",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Mutation to distribute rewards
  const distributeRewardsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/rewards/distribute-rewards', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/pool-stats'] });
      toast({
        title: "Rewards distributed",
        description: `Successfully distributed rewards to ${data.recipientCount} creators.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to distribute rewards",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Extract pool wallet address
  const poolAddress = poolStats?.poolAddress;
  
  // Handle submit configuration
  const handleSaveConfig = () => {
    updatePoolConfigMutation.mutate({
      uploadPoolPercentage: uploadPercentage,
      likePoolPercentage: likePercentage,
      dailyDistribution: distributionPercentage,
    });
  };
  
  // Calculate daily distribution amount in XNO
  const dailyAmount = poolStats ? 
    (poolStats.totalPool * distributionPercentage / 100).toFixed(6) : 
    "0.000000";
    
  const handleDistributeRewards = () => {
    distributeRewardsMutation.mutate();
  };
  
  // Error, loading, or not configured states
  if (isLoadingPoolStats) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pool Wallet Management</CardTitle>
          <CardDescription>Loading reward pool data...</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }
  
  if (poolStatsError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pool Wallet Management</CardTitle>
          <CardDescription>Error loading reward pool data</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center justify-center p-6 bg-red-50 rounded-lg">
            <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Error Connecting to Pool</h3>
              <p className="text-red-600">
                Unable to load pool data. Please check the pool wallet configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!poolAddress) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pool Wallet Management</CardTitle>
          <CardDescription>Configure your reward pool wallet</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center justify-center p-6 bg-amber-50 rounded-lg">
            <AlertCircle className="h-10 w-10 text-amber-500 mr-4" />
            <div>
              <h3 className="text-lg font-semibold text-amber-800">Pool Not Configured</h3>
              <p className="text-amber-600">
                The pool wallet has not been configured. Please run the generate-pool-wallet.js script 
                and set the POOL_WALLET_ADDRESS and POOL_WALLET_PRIVATE_KEY secrets.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex flex-col w-full space-y-4">
            <p className="text-sm text-gray-500">
              To generate a pool wallet, run the following command in your terminal:
            </p>
            <code className="bg-gray-100 p-2 rounded text-sm">
              node generate-pool-wallet.js
            </code>
            <p className="text-sm text-gray-500">
              Follow the instructions to save the address and private key as Replit secrets.
            </p>
          </div>
        </CardFooter>
      </Card>
    );
  }
  
  // Main UI when pool is configured
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pool Wallet</CardTitle>
          <CardDescription>Manage the XNO reward pool wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Wallet className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium">Pool Address:</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm mr-2 font-mono">{poolAddress.slice(0, 12)}...{poolAddress.slice(-8)}</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => {
                    window.open(`https://nanexplorer.com/nano/${poolAddress}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <BarChart3 className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium">Total Pool:</span>
              </div>
              <Badge variant="outline" className="bg-green-50 hover:bg-green-50">
                <span className="text-green-700 font-bold">{poolStats?.totalPool.toFixed(6)} XNO</span>
              </Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Current Pool Configuration</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 p-2 rounded">
                  <span className="text-xs text-gray-500 block">Upload Rewards:</span>
                  <span className="font-medium text-blue-700">{poolStats?.uploadPoolPercentage}%</span>
                </div>
                <div className="bg-purple-50 p-2 rounded">
                  <span className="text-xs text-gray-500 block">Like Rewards:</span>
                  <span className="font-medium text-purple-700">{poolStats?.likePoolPercentage}%</span>
                </div>
                <div className="bg-amber-50 p-2 rounded">
                  <span className="text-xs text-gray-500 block">Daily Distribution:</span>
                  <span className="font-medium text-amber-700">{poolStats?.dailyDistribution}%</span>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <span className="text-xs text-gray-500 block">Daily Amount:</span>
                  <span className="font-medium text-green-700">
                    {(poolStats?.totalPool * poolStats?.dailyDistribution / 100).toFixed(6)} XNO
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="default" 
                className="w-full"
                disabled={distributeRewardsMutation.isPending}
              >
                {distributeRewardsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Distributing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Distribute Daily Rewards
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Distribute Rewards</AlertDialogTitle>
                <AlertDialogDescription>
                  This will distribute {(poolStats?.totalPool * poolStats?.dailyDistribution / 100).toFixed(6)} XNO 
                  from the pool to all content creators based on their engagement metrics.
                  
                  <div className="mt-4 p-3 bg-amber-50 rounded-md text-amber-800 text-sm">
                    This action cannot be undone. The transactions will be recorded on the XNO blockchain.
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDistributeRewards}>
                  Confirm Distribution
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Reward Configuration</CardTitle>
          <CardDescription>Configure reward distribution parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Upload Rewards</label>
                <span className="text-sm text-blue-600 font-medium">{uploadPercentage}%</span>
              </div>
              <Slider 
                value={[uploadPercentage]} 
                min={0} 
                max={100} 
                step={5}
                onValueChange={(values) => {
                  const newValue = values[0];
                  setUploadPercentage(newValue);
                  setLikePercentage(100 - newValue);
                }}
              />
              <p className="text-xs text-gray-500">
                Percentage of rewards allocated to content creators based on their uploads.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Like Rewards</label>
                <span className="text-sm text-purple-600 font-medium">{likePercentage}%</span>
              </div>
              <Slider 
                value={[likePercentage]} 
                min={0} 
                max={100} 
                step={5}
                onValueChange={(values) => {
                  const newValue = values[0];
                  setLikePercentage(newValue);
                  setUploadPercentage(100 - newValue);
                }}
              />
              <p className="text-xs text-gray-500">
                Percentage of rewards allocated to content creators based on likes received.
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Daily Distribution</label>
                <span className="text-sm text-amber-600 font-medium">{distributionPercentage}%</span>
              </div>
              <Slider 
                value={[distributionPercentage]} 
                min={1} 
                max={20} 
                step={1}
                onValueChange={(values) => {
                  setDistributionPercentage(values[0]);
                }}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Percentage of the pool to distribute daily:
                </p>
                <Badge variant="outline" className="bg-amber-50 hover:bg-amber-50">
                  <span className="text-amber-700 font-medium">{dailyAmount} XNO</span>
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full">
            <AlertDialog open={showConfigConfirm} onOpenChange={setShowConfigConfirm}>
              <AlertDialogTrigger asChild>
                <Button 
                  className="w-full" 
                  variant="outline"
                  disabled={updatePoolConfigMutation.isPending}
                >
                  {updatePoolConfigMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Configuration"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Pool Configuration</AlertDialogTitle>
                  <AlertDialogDescription>
                    <p>You are about to update the pool configuration to:</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>Upload Rewards: <strong>{uploadPercentage}%</strong></li>
                      <li>Like Rewards: <strong>{likePercentage}%</strong></li>
                      <li>Daily Distribution: <strong>{distributionPercentage}%</strong> ({dailyAmount} XNO)</li>
                    </ul>
                    <p className="mt-4">Are you sure you want to proceed?</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSaveConfig}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}