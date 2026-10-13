'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useWallet } from '@/hooks/useWallet';
import { useWalletConnectors } from '@/hooks/useWallet';
import { TokenLogo } from '@/components/wallet/TokenLogo';

export function ConnectSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { connect, disconnect, isConnected, isConnecting } = useWallet();
  const connectors = useWalletConnectors();

  const handleConnect = async (id: string) => {
    await connect(id);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto bg-white text-gray-900">
        <SheetHeader className="text-center">
          <div className="mx-auto mb-2"><TokenLogo symbol="DEV26" size={56} /></div>
          <SheetTitle className="text-2xl font-bold">Welcome to DEVCITY26 Wallet</SheetTitle>
          <SheetDescription className="text-sm text-gray-500">Connect your wallet to hold DEV26, claim drops and trade on Celo Sepolia</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {connectors.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              className="w-full justify-start px-4 py-3.5 h-auto"
              disabled={isConnecting}
              isLoading={isConnecting}
              onClick={() => handleConnect(c.id)}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-base">{c.name.charAt(0)}</span>
              <span className="text-sm font-semibold text-gray-900">Connect {c.name}</span>
            </Button>
          ))}
        </div>

        <p className="pb-4 text-center text-xs text-gray-400">
          By connecting you agree to transact on the Celo Sepolia testnet.
        </p>
      </SheetContent>
    </Sheet>
  );
}
