import { useState, useCallback } from "react";
import { Share2, StopCircle, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveShareStore } from "@/store/useLiveShareStore";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

/**
 * LiveShareButton component
 *
 * Toggles the Live Share session and shows the shareable link.
 */
export function LiveShareButton() {
  const { isSharing, sessionId, startSharing, stopSharing, peerCount } = useLiveShareStore();
  const [copied, setCopied] = useState(false);

  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 10) + 
           Math.random().toString(36).substring(2, 10);
  };

  const handleToggle = useCallback(() => {
    if (isSharing) {
      stopSharing();
      toast.success("Live Share stopped");
    } else {
      const newId = generateSessionId();
      startSharing(newId);
      toast.success("Live Share started!");
    }
  }, [isSharing, startSharing, stopSharing]);

  const copyLink = () => {
    const link = `${window.location.origin}/share/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied to clipboard");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isSharing ? "secondary" : "ghost"}
          size="sm"
          className={`h-8 gap-1.5 text-xs ${isSharing ? "text-primary animate-pulse" : ""}`}
          aria-label={isSharing ? "Stop Live Share" : "Start Live Share"}
        >
          {isSharing ? (
            <StopCircle className="h-3.5 w-3.5" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          {isSharing ? "Sharing" : "Live Share"}
          {isSharing && peerCount > 0 && (
            <span className="ml-1 flex items-center gap-1 font-mono text-[10px]">
              <Users className="h-3 w-3" />
              {peerCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Live Share Session</h4>
            <p className="text-sm text-muted-foreground">
              {isSharing
                ? "Other users can see your editor in real-time."
                : "Share your editor with others in read-only mode."}
            </p>
          </div>
          {isSharing ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/share/${sessionId}`}
                  readOnly
                  className="h-8 text-xs font-mono"
                />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={copyLink}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full text-xs"
                onClick={handleToggle}
              >
                Stop Sharing
              </Button>
            </div>
          ) : (
            <Button size="sm" className="w-full text-xs" onClick={handleToggle}>
              Start Sharing Live Session
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
