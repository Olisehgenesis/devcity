'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TokenLogo } from '@/components/wallet/TokenLogo';
import { useAppStore } from '@/lib/store';
import { CELO_SEPOLIA, DROP_CLAIM_ABI } from '@/lib/chain';
import { ArrowLeft, Check, Gift } from 'lucide-react';
import { formatTokenAmount } from '@/lib/utils';

export function ClaimSheet({ onBack }: { onBack: () => void }) {
  const isOpen = useAppStore((s) => s.activeBottomSheet === 'wallet');
  const onClose = () => useAppStore.getState().setActiveBottomSheet('none');
  const { drops, claims, loadDrops, loadClaims, authorizeClaim, addNotification } = useAppStore();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDrops();
      loadClaims();
    }
  }, [isOpen, loadDrops, loadClaims]);

  const handleClaim = useCallback(async (drop: any) => {
    setClaimingId(drop.id);
    setError(null);
    try {
      if (!isConnected || !address) throw new Error('Connect your wallet first');
      // Backend signs an authorization for this claim.
      const auth = await authorizeClaim(drop.id);
      if (!auth) throw new Error('Claim not authorized');

      // Read the user's current nonce on-chain to satisfy DropClaim.claim.
      const nonce = await publicClient!.readContract({
        address: CELO_SEPOLIA.dropClaim as any,
        abi: DROP_CLAIM_ABI as any,
        functionName: 'getUserNonce',
        args: [address as any],
      });

      const amount = BigInt(auth.amount);
      const deadline = BigInt(auth.expiresAt);
      const dropId = drop.id as `0x${string}`;

      await writeContractAsync({
        address: CELO_SEPOLIA.dropClaim as any,
        abi: DROP_CLAIM_ABI as any,
        functionName: 'claim',
        args: [dropId, address as any, amount, nonce as any, deadline, auth.signature as any],
      });
      addNotification({ type: 'success', message: `Claimed ${drop.tokenSymbol || 'tokens'} — check your wallet` });
      await loadClaims();
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Claim failed';
      setError(msg);
      addNotification({ type: 'error', message: msg });
    } finally {
      setClaimingId(null);
    }
  }, [isConnected, address, publicClient, writeContractAsync, authorizeClaim, addNotification, loadClaims]);

  const claimedDropIds = new Set((claims || []).map((c: any) => c.dropId));

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto bg-white text-gray-900">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Back">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-500">Drops & claims</span>
            <span className="w-8" />
          </div>
        </SheetHeader>

        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Eligible rewards</h3>
            {drops && drops.length > 0 ? (
              <div className="space-y-2">
                {drops.map((drop: any) => {
                  const claimed = claimedDropIds.has(drop.id);
                  const eligible = !claimed && drop.status !== 'ended' && drop.status !== 'claimed-out';
                  return (
                    <div key={drop.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <TokenLogo symbol={drop.tokenSymbol || 'DEV26'} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{drop.name || `${drop.tokenSymbol || 'DEV26'} drop`}</p>
                        <p className="text-xs text-gray-400">
                          {formatTokenAmount(drop.amountPerClaim)} {drop.tokenSymbol} · {drop.currentClaimants}/{drop.maxClaimants} claimed
                        </p>
                      </div>
                      {claimed ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><Check className="h-4 w-4" /> Claimed</span>
                      ) : (
                        <Button
                          size="sm"
                          variant={eligible ? 'default' : 'outline'}
                          disabled={!eligible || claimingId === drop.id}
                          isLoading={claimingId === drop.id}
                          onClick={() => handleClaim(drop)}
                        >
                          {drop.status === 'upcoming' ? 'Soon' : 'Claim'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center">
                <Gift className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">No active drops right now</p>
                <p className="text-xs text-gray-300 mt-1">Eligible rewards will appear here</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Claim history</h3>
            {claims && claims.length > 0 ? (
              <div className="space-y-2">
                {claims.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                    <TokenLogo symbol={c.tokenSymbol || 'DEV26'} size={32} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Claimed {c.tokenSymbol}</p>
                      <p className="text-xs text-gray-400">{new Date(c.claimedAt).toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{Number(c.amount).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No claims yet.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
