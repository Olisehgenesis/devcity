'use client';

import { Sheet } from './Sheet';
import { PasskeyWallet } from './PasskeyWallet';
import { useAccount, useDisconnect } from 'wagmi';

interface WalletSheetProps {
  open: boolean;
  onClose: () => void;
  notify: (message: string) => void;
}

export function WalletSheet({ open, onClose, notify }: WalletSheetProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Your money in the city" title="Wallet">
      <PasskeyWallet onNotify={notify} />
      {isConnected && address && (
        <section className="external-wallet-section">
          <div>
            <strong>Connected browser wallet</strong>
            <span>{address.slice(0, 8)}…{address.slice(-6)}</span>
          </div>
          <button onClick={() => { disconnect(); notify('Browser wallet disconnected.'); }}>Disconnect</button>
        </section>
      )}
    </Sheet>
  );
}
