"use client";

import { use, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import Index from "@/features/ide/Index";
import { useLiveShareStore } from "@/store/useLiveShareStore";
import { Shield } from "lucide-react";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const { id } = use(params);
  const [queryClient] = useState(() => new QueryClient());
  const { joinSession, reset } = useLiveShareStore();

  useEffect(() => {
    if (id) {
      joinSession(id);
    }
    return () => {
      reset();
    };
  }, [id, joinSession, reset]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <div className="relative h-screen flex flex-col overflow-hidden">
            {/* Read-only banner */}
            <div className="bg-primary/10 border-b border-primary/20 px-4 py-1 flex items-center justify-center gap-2 text-[10px] text-primary font-mono uppercase tracking-widest z-50">
              <Shield className="h-3 w-3" />
              Viewing Live Session (Read-only)
            </div>
            
            <div className="flex-1 min-h-0">
              <Index />
            </div>
          </div>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
