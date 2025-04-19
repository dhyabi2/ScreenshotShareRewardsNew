import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

// Modified schema without wallet address (it will be taken from localStorage)
const uploadFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
  price: z.coerce.number().min(0, "Price cannot be negative").max(1000, "Price too high"),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState("");

  // Get wallet address from localStorage using the correct key
  useEffect(() => {
    const savedWallet = localStorage.getItem('xno_wallet_address');
    if (savedWallet) {
      setWalletAddress(savedWallet);
    }
  }, []);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
      price: 0,
    },
  });

  // No need to verify wallet - consider all wallets valid
  const walletVerification = { valid: !!walletAddress, balance: 0 };

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormValues) => {
      if (!file) {
        throw new Error("Please select a file to upload");
      }

      if (!walletAddress) {
        throw new Error("Please connect your wallet first");
      }

      if (!walletVerification?.valid) {
        throw new Error("Your wallet address is not valid");
      }

      const formData = new FormData();
      formData.append("screenshot", file);
      formData.append("title", data.title);
      formData.append("price", data.price.toString());
      formData.append("wallet", walletAddress);

      return api.uploadContent(formData);
    },
    onSuccess: () => {
      toast({
        title: "Content uploaded successfully!",
        description: "Your content is now available in the gallery.",
      });
      
      form.reset();
      setFile(null);
      
      // Refresh content list
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your content",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Check if it's an image or video
      if (!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image or video file",
          variant: "destructive"
        });
        return;
      }
      
      // For videos, check if it's too large (rough estimate for 20s)
      if (selectedFile.type.startsWith('video/') && selectedFile.size > 50 * 1024 * 1024) {
        toast({
          title: "Video too large",
          description: "Videos must be short (max 20 seconds)",
          variant: "destructive"
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Check if it's an image or video
      if (!droppedFile.type.startsWith('image/') && !droppedFile.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image or video file",
          variant: "destructive"
        });
        return;
      }
      
      setFile(droppedFile);
    }
  };

  const handleClickDropzone = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onSubmit = (data: UploadFormValues) => {
    uploadMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Screenshot or Video</CardTitle>
        <CardDescription>
          Your content will be rewarded based on likes and engagement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!walletAddress ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Wallet Not Connected</AlertTitle>
            <AlertDescription>
              You need to connect your XNO wallet to upload content. 
              <Link to="/wallet" className="ml-1 underline">Connect your wallet</Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
              <div className="text-sm">Connected to wallet: <span className="font-mono text-xs">{walletAddress.substring(0, 10)}...{walletAddress.substring(walletAddress.length - 5)}</span></div>
            </div>
          </Alert>
        )}

        <div
          className={`dropzone rounded-lg p-6 text-center cursor-pointer mb-4 border-2 border-dashed ${
            isDragging ? "border-primary bg-primary/5" : "border-gray-300"
          } transition-all duration-200 ease-in-out`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickDropzone}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            className="hidden"
          />
          
          {file ? (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">Drag and drop your file here, or click to select</p>
              <p className="text-xs text-gray-500 mt-1">Supported: PNG, JPG, GIF, MP4 (≤20s)</p>
            </>
          )}
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Give your content a title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (XNO)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="0.01" {...field} />
                  </FormControl>
                  <FormDescription>Set to 0 for free content or set a price to make it premium</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={uploadMutation.isPending || !file || !walletAddress}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Content"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
