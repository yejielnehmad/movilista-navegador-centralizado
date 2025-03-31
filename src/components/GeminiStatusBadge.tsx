
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';
import { AlertCircle, CheckCircle, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface GeminiStatusBadgeProps {
  className?: string;
}

const GeminiStatusBadge: React.FC<GeminiStatusBadgeProps> = ({ className }) => {
  const { connectionStatus, checkConnection } = useGemini();
  const [isCheckingConnection, setIsCheckingConnection] = React.useState(false);

  // Define badge content based on connection status
  const getBadgeContent = () => {
    switch (connectionStatus) {
      case GeminiConnectionStatus.CONNECTED:
        return {
          icon: <CheckCircle className="h-3.5 w-3.5 mr-1" />,
          text: 'Gemini Ready',
          variant: 'default' as const,
          tooltipText: 'Connected to Gemini AI'
        };
      case GeminiConnectionStatus.CONNECTING:
        return {
          icon: <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />,
          text: 'Connecting',
          variant: 'secondary' as const,
          tooltipText: 'Connecting to Gemini AI'
        };
      case GeminiConnectionStatus.ERROR:
        return {
          icon: <AlertCircle className="h-3.5 w-3.5 mr-1" />,
          text: 'API Error',
          variant: 'destructive' as const,
          tooltipText: 'Failed to connect to Gemini AI'
        };
      case GeminiConnectionStatus.DISCONNECTED:
      default:
        return {
          icon: <WifiOff className="h-3.5 w-3.5 mr-1" />,
          text: 'Disconnected',
          variant: 'outline' as const,
          tooltipText: 'Gemini AI is disconnected'
        };
    }
  };

  const handleCheckConnection = async () => {
    if (isCheckingConnection) return;
    
    setIsCheckingConnection(true);
    try {
      toast.info("Checking Gemini API connection...");
      const result = await checkConnection();
      if (result) {
        toast.success("Successfully connected to Gemini API");
      } else {
        toast.error("Failed to connect to Gemini API");
      }
    } catch (error) {
      console.error("Error checking connection:", error);
      toast.error("Error checking Gemini API connection");
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const badgeContent = getBadgeContent();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={badgeContent.variant}
            className={cn(
              "cursor-pointer transition-all text-xs font-medium",
              connectionStatus === GeminiConnectionStatus.CONNECTED && "bg-green-500 hover:bg-green-600",
              connectionStatus === GeminiConnectionStatus.ERROR && "bg-red-500 hover:bg-red-600",
              isCheckingConnection && "opacity-70 pointer-events-none",
              className
            )}
            onClick={handleCheckConnection}
          >
            {isCheckingConnection ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              badgeContent.icon
            )}
            {badgeContent.text}
            {!isCheckingConnection && connectionStatus !== GeminiConnectionStatus.CONNECTING && (
              <RefreshCw className="h-3 w-3 ml-1 opacity-70" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badgeContent.tooltipText}</p>
          <p className="text-xs">Click to check connection</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default GeminiStatusBadge;
