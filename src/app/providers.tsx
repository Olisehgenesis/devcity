'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider
          delayDuration={200}
          skipDelayDuration={0}
          disableHoverableContent
        >
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}