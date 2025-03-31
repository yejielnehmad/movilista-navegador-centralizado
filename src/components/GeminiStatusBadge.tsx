
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';
import { AlertCircle, CheckCircle, Loader2, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GeminiStatusBadgeProps {
  className?: string;
}

const GeminiStatusBadge: React.FC<GeminiStatusBadgeProps> = ({ className }) => {
  const { connectionStatus, checkConnection } = useGemini();

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
              className
            )}
            onClick={() => checkConnection()}
          >
            {badgeContent.icon}
            {badgeContent.text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badgeContent.tooltipText}</p>
          {(connectionStatus === GeminiConnectionStatus.ERROR || 
            connectionStatus === GeminiConnectionStatus.DISCONNECTED) && (
            <p className="text-xs">Click to retry connection</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default GeminiStatusBadge;
