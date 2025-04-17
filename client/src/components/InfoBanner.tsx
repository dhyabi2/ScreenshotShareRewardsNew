import { Info } from "lucide-react";

interface InfoBannerProps {
  title: string;
  message: string;
}

export default function InfoBanner({ title, message }: InfoBannerProps) {
  return (
    <div className="mb-6 bg-primary bg-opacity-10 rounded-lg p-4 flex items-start">
      <Info className="h-6 w-6 text-primary mr-3 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="text-primary font-medium">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{message}</p>
      </div>
    </div>
  );
}
