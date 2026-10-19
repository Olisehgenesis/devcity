'use client';

import type { FeeQuote } from '@/lib/gas';

export function FeePreview({ quote, error, loading }: { quote: FeeQuote | null; error: string; loading: boolean }) {
  if (loading) {
    return <p className="wallet-fee-preview" role="status"><span className="balance-skeleton" /> Estimating network fee…</p>;
  }
  if (error) {
    return <p className="you-error wallet-fee-preview" role="alert">{error}</p>;
  }
  if (!quote) return null;
  const fallback = quote.requestedSymbol
    && quote.requestedSymbol.toUpperCase() !== quote.symbol.toUpperCase();
  return (
    <p className="wallet-fee-preview" role="status">
      Estimated network fee <strong>{quote.display}</strong>
      {fallback && (
        <> {quote.requestedSymbol} cannot cover this fee, so the estimate uses {quote.symbol}.</>
      )}
    </p>
  );
}
