"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CopyToClipboardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  children?: ReactNode;
  onCopied?: () => void;
}

export function CopyToClipboard({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  iconOnly = true,
  children,
  className,
  disabled,
  onCopied,
  onClick,
  ...props
}: CopyToClipboardProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleCopy: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = async (event) => {
    onClick?.(event);
    if (event?.defaultPrevented) {
      return;
    }

    if (disabled) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTooltipOpen(true);
      onCopied?.();

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        setTooltipOpen(false);
      }, 1200);
    } catch {
      setCopied(false);
      setTooltipOpen(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setTooltipOpen(false);
      }, 1200);
    }
  };

  return (
    <Tooltip open={tooltipOpen} onOpenChange={(nextOpen) => !copied && setTooltipOpen(nextOpen)}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={copied ? copiedLabel : label}
          onClick={handleCopy}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
            iconOnly ? "p-1" : "gap-1.5 px-2 py-1 text-xs",
            className,
          )}
          {...props}
        >
          {children ?? (copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />)}
        </button>
      </TooltipTrigger>
      <TooltipContent className="px-2 py-1 text-[11px]">
        {copied ? copiedLabel : label}
      </TooltipContent>
    </Tooltip>
  );
}
