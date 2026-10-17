'use client';

import { Sheet } from './Sheet';
import { PasskeyWallet } from './PasskeyWallet';
import { useAccount, useDisconnect } from 'wagmi';

interface WalletSheetProps {
  open: boolean;
  onClose: () => void;
  notify: (message: string) => void;
  onCreateDrop?: () => void;
}

export function WalletSheet({ open, onClose, notify, onCreateDrop }: WalletSheetProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <Sheet open={open} onClose={onClose} title="Wallet" size="vault">
      <PasskeyWallet
        onNotify={notify}
        onCreateDrop={onCreateDrop}
        browserWallet={isConnected && address ? {
          address,
          onDisconnect: () => { disconnect(); notify('Browser wallet disconnected.'); },
        } : null}
      />
    </Sheet>
  );
}
