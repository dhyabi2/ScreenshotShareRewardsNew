import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Content } from "@/types";
import ContentCard from "./ContentCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ContentGalleryProps {
  limit?: number;
}

export default function ContentGallery({ limit = 10 }: ContentGalleryProps) {
  const [page, setPage] = useState(1);
  
  const { data: allContent, isLoading, isError } = useQuery<Content[]>({
    queryKey: ['/api/content'],
  });
  
  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };
  
  const handleNextPage = () => {
    if (allContent && page * limit < allContent.length) {
      setPage(page + 1);
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="h-48 bg-gray-200 animate-pulse"></div>
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isError || !allContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500">Failed to load content. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const paginatedContent = allContent.slice(startIndex, startIndex + limit);
  const totalPages = Math.ceil(allContent.length / limit);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Uploads</CardTitle>
      </CardHeader>
      <CardContent>
        {paginatedContent.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No content available. Be the first to upload!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paginatedContent.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        )}
      </CardContent>
      
      {allContent.length > limit && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(startIndex + limit, allContent.length)} of {allContent.length} uploads
          </span>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={page === 1}
              className="flex items-center"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNextPage}
              disabled={page === totalPages}
              className="flex items-center bg-primary text-white hover:bg-primary/90"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
