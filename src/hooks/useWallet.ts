import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { useCallback, useState } from 'react';
import type { WalletState } from '@/types';
import { SUPPORTED_CHAINS } from '@/lib/wallet';

export function useWallet(): WalletState & {
  connect: (connector?: string) => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
  isCorrectChain: boolean;
} {
  const { address, isConnected, chainId, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();
  const [isSmartAccount, setIsSmartAccount] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);

  const handleConnect = useCallback(
    async (connectorId?: string) => {
      const connector = connectorId
        ? connectors.find((c) => c.id === connectorId)
        : connectors.find((c) => c.id === 'coinbaseWallet') || connectors[0];

      if (connector) {
        await connect({ connector });
        setIsSmartAccount(connector.id === 'coinbaseWallet');
      }
    },
    [connect, connectors]
  );

  const handleSwitchChain = useCallback(
    async (targetChainId: number) => {
      if (!SUPPORTED_CHAINS.some((c) => c.id === targetChainId)) return;
      await switchChain({ chainId: targetChainId });
    },
    [switchChain]
  );

  const isCorrectChain = SUPPORTED_CHAINS.some((c) => c.id === currentChainId);

  return {
    isConnected,
    address,
    chainId: currentChainId,
    isConnecting,
    isSmartAccount,
    passkeyRegistered,
    connect: handleConnect,
    disconnect,
    switchChain: handleSwitchChain,
    isCorrectChain,
  };
}

export function useWalletConnectors() {
  const { connectors } = useConnect();
  return connectors;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useCallback(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}