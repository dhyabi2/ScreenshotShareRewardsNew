import React from 'react';
import { Helmet } from 'react-helmet';
import PoolWalletManager from '@/components/admin/PoolWalletManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminPool() {
  // Check if content creators exist to distribute rewards to
  const { data: content, isLoading } = useQuery({ 
    queryKey: ['/api/content'],
  });
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Helmet>
        <title>Pool Administration - Screenshot Share</title>
      </Helmet>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pool Administration</h1>
        <p className="text-lg text-gray-600">
          Manage the Self-Sustained XNO Reward Pool
        </p>
      </div>
      
      <div className="space-y-8">
        <PoolWalletManager />
        
        <div>
          <h2 className="text-2xl font-bold mb-4">Content Creator Statistics</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : content?.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Content Available</CardTitle>
                <CardDescription>
                  There are no content creators in the system yet. Once users upload content, their statistics will appear here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Content Statistics</CardTitle>
                  <CardDescription>
                    Overview of content uploads and engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Total Content</div>
                      <div className="text-2xl font-bold text-blue-700">{content?.length || 0}</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Total Creators</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {new Set(content?.map(c => c.walletAddress) || []).size}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Total Likes</div>
                      <div className="text-2xl font-bold text-green-700">
                        {content?.reduce((sum, c) => sum + (c.likeCount || 0), 0) || 0}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Active Content</div>
                      <div className="text-2xl font-bold text-purple-700">
                        {content?.filter(c => c.status === 'active').length || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Top Creators</CardTitle>
                  <CardDescription>
                    Content creators with the most uploads and engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {content && content.length > 0 ? (
                    <div className="space-y-4">
                      {/* Group by creator and get top 5 */}
                      {Object.entries(
                        content.reduce((acc, item) => {
                          const address = item.walletAddress;
                          if (!acc[address]) {
                            acc[address] = { 
                              uploads: 0, 
                              likes: 0,
                              earnings: 0
                            };
                          }
                          acc[address].uploads += 1;
                          acc[address].likes += (item.likeCount || 0);
                          return acc;
                        }, {} as Record<string, { uploads: number, likes: number, earnings: number }>)
                      )
                        .sort((a, b) => (b[1].uploads + b[1].likes) - (a[1].uploads + a[1].likes))
                        .slice(0, 5)
                        .map(([address, stats], index) => (
                          <div key={address} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 font-semibold mr-3">
                                {index + 1}
                              </div>
                              <div>
                                <div className="font-medium">
                                  {address.slice(0, 10)}...{address.slice(-5)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {stats.uploads} uploads • {stats.likes} likes
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-semibold">
                              Estimated: {stats.earnings.toFixed(6)} XNO
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No creator data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}