'use client';

import { useState } from 'react';
import { ArrowUpDown, Info, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, parseAbi } from 'viem';
import { CELO_SEPOLIA, DEVCITY26_TOKEN_ABI, ERC20_ABI } from '@/lib/chain';
import { buildBuyCallData, encodeSell, encodeApprove } from '@/lib/trade';

export function WalletTradeTab() {
  const { address, isConnected } = useAccount();
  const [fromToken, setFromToken] = useState<'USDT' | 'DEV26'>('USDT');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [swapping, setSwapping] = useState(false);
  const [approving, setApproving] = useState(false);

  // Read balances
  const { data: usdtBalance } = useReadContract({
    address: CELO_SEPOLIA.usdt,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: dev26Balance } = useReadContract({
    address: CELO_SEPOLIA.devcityToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read allowances
  const { data: usdtAllowance } = useReadContract({
    address: CELO_SEPOLIA.usdt,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CELO_SEPOLIA.universalRouter] : undefined,
    query: { enabled: !!address },
  });

  const { data: dev26Allowance } = useReadContract({
    address: CELO_SEPOLIA.devcityToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CELO_SEPOLIA.devcityToken] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract: approveToken } = useWriteContract();
  const { writeContract: executeSwap } = useWriteContract();

  const isBuy = fromToken === 'USDT';
  const inputToken = isBuy ? 'USDT' : 'DEV26';
  const outputToken = isBuy ? 'DEV26' : 'USDT';
  const inputBalance = isBuy ? usdtBalance : dev26Balance;
  const currentAllowance = isBuy ? usdtAllowance : dev26Allowance;

  const needsApproval = currentAllowance && amount
    ? parseUnits(amount || '0', 6) > currentAllowance
    : true;

  const handleApprove = async () => {
    if (!address || !amount) return;

    setApproving(true);
    try {
      const amountBigInt = parseUnits(amount, 6);
      const spender = isBuy ? CELO_SEPOLIA.universalRouter : CELO_SEPOLIA.devcityToken;
      const tokenAddress = isBuy ? CELO_SEPOLIA.usdt : CELO_SEPOLIA.devcityToken;

      approveToken({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amountBigInt],
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!address || !amount) return;

    setSwapping(true);
    try {
      const amountBigInt = parseUnits(amount, 6);
      const slippagePercent = parseFloat(slippage) / 100;
      const minOut = amountBigInt * BigInt(Math.floor((1 - slippagePercent) * 1000000)) / BigInt(1000000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

      if (isBuy) {
        // Buy: USDT -> DEV26 via UniversalRouter
        const callData = buildBuyCallData(amountBigInt, minOut, deadline);
        executeSwap({
          address: CELO_SEPOLIA.universalRouter,
          abi: parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']),
          functionName: 'execute',
          args: [
            '0x10', // V4_SWAP command
            [callData],
            deadline,
          ],
        });
      } else {
        // Sell: DEV26 -> USDT via burnForUSDT
        const callData = encodeSell(amountBigInt, minOut, deadline);
        executeSwap({
          address: CELO_SEPOLIA.devcityToken,
          abi: DEVCITY26_TOKEN_ABI,
          functionName: 'burnForUSDT',
          args: [amountBigInt, minOut, deadline],
        });
      }
    } catch (error) {
      console.error('Swap failed:', error);
    } finally {
      setSwapping(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="wallet-tab-empty">
        <p>Connect your wallet to trade tokens</p>
      </div>
    );
  }

  return (
    <div className="wallet-trade-tab">
      <div className="trade-header">
        <h3>Trade</h3>
        <button
          onClick={() => setFromToken(isBuy ? 'DEV26' : 'USDT')}
          className="trade-swap-direction"
          aria-label="Swap direction"
        >
          <ArrowUpDown size={16} />
        </button>
      </div>

      <div className="trade-inputs">
        <div className="trade-input-group">
          <label>From</label>
          <div className="trade-input-wrapper">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="trade-input"
            />
            <span className="trade-token-badge">{inputToken}</span>
          </div>
          <span className="trade-balance">
            Balance: {inputBalance ? formatUnits(inputBalance, 6) : '0'} {inputToken}
          </span>
        </div>

        <div className="trade-input-group">
          <label>To</label>
          <div className="trade-input-wrapper trade-input-disabled">
            <input
              type="text"
              placeholder="0.00"
              value={amount ? (parseFloat(amount) * 0.95).toFixed(6) : ''}
              readOnly
              className="trade-input"
            />
            <span className="trade-token-badge">{outputToken}</span>
          </div>
          <span className="trade-balance">
            Balance: {isBuy ? (dev26Balance ? formatUnits(dev26Balance, 6) : '0') : (usdtBalance ? formatUnits(usdtBalance, 6) : '0')} {outputToken}
          </span>
        </div>
      </div>

      <div className="trade-settings">
        <label>Slippage Tolerance</label>
        <div className="trade-slippage-options">
          {['0.1', '0.5', '1.0'].map((value) => (
            <button
              key={value}
              onClick={() => setSlippage(value)}
              className={`trade-slippage-btn ${slippage === value ? 'is-active' : ''}`}
            >
              {value}%
            </button>
          ))}
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="trade-slippage-custom"
            placeholder="Custom"
            step="0.1"
            min="0"
            max="50"
          />
        </div>
      </div>

      <div className="trade-info">
        <Info size={14} />
        <span>Estimated output shown (actual may vary based on slippage)</span>
      </div>

      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={approving || !amount}
          className="trade-button trade-button-approve"
        >
          {approving ? <Loader2 size={16} className="animate-spin" /> : 'Approve ' + inputToken}
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={swapping || !amount}
          className="trade-button trade-button-swap"
        >
          {swapping ? <Loader2 size={16} className="animate-spin" /> : `Swap ${inputToken} → ${outputToken}`}
        </button>
      )}
    </div>
  );
}
