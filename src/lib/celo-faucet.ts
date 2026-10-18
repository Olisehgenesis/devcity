import { getAddress, isAddress } from "viem";

const FAUCET_URL = "https://faucet.celo.org/api/faucet";
const STATUS_URL = "https://faucet.celo.org/api/status";
const NETWORK = "celo-sepolia";

export type FaucetOutcome =
  | { state: "queued"; statusKey: string; message: string }
  | { state: "confirmed"; statusKey: string; txHash: string }
  | { state: "failed"; message: string; code?: string; retryAfterSeconds?: number };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class FaucetConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaucetConfigError";
  }
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function assertFaucetAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new FaucetConfigError("Enter a valid test-wallet address.");
  }
  return getAddress(address);
}

/**
 * Queue a Celo Sepolia faucet payout and poll until it settles or the attempt budget ends.
 * A queued or pending status is never reported as a confirmed transaction.
 */
export async function requestSepoliaFaucet(
  address: string,
  options: {
    apiKey?: string;
    fetchImpl?: FetchLike;
    pollAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<FaucetOutcome> {
  const apiKey = options.apiKey ?? process.env.CELO_FAUCET_API_KEY;
  if (!apiKey) {
    throw new FaucetConfigError("CELO_FAUCET_API_KEY is not configured on the server.");
  }
  const beneficiary = assertFaucetAddress(address);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(FAUCET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ beneficiary, network: NETWORK }),
  });
  const body = await readJson(response);
  if (response.status === 429 || response.status === 503) {
    return {
      state: "failed",
      code: typeof body.error === "string" ? body.error : response.status === 429 ? "faucet_limit_exceeded" : "faucet_unavailable",
      message: typeof body.message === "string" ? body.message : "The faucet is not accepting requests right now.",
      retryAfterSeconds: retryAfterSeconds(response) ?? (response.status === 503 ? 30 : undefined),
    };
  }
  if (!response.ok || body.status === "Failed") {
    return {
      state: "failed",
      code: typeof body.error === "string" ? body.error : undefined,
      message: typeof body.message === "string" ? body.message : "The faucet rejected this request.",
    };
  }
  const statusKey = typeof body.key === "string" ? body.key : "";
  if (!statusKey) {
    return { state: "failed", message: "The faucet queued a request without a status key." };
  }
  const attempts = options.pollAttempts ?? 4;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(1500);
    const status = await readFaucetStatus(statusKey, fetchImpl);
    if (status.state === "confirmed" || status.state === "failed") return status;
  }
  return {
    state: "queued",
    statusKey,
    message: "The faucet queued this payout. A queued request is not an on-chain transaction yet.",
  };
}

export async function readFaucetStatus(statusKey: string, fetchImpl: FetchLike = fetch): Promise<FaucetOutcome> {
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(statusKey)) {
    return { state: "failed", message: "That faucet status key is not valid." };
  }
  const response = await fetchImpl(`${STATUS_URL}?key=${encodeURIComponent(statusKey)}&network=${NETWORK}`);
  const body = await readJson(response);
  if (response.status === 404) return { state: "failed", message: "The faucet has no request with that key." };
  if (!response.ok) {
    return { state: "failed", message: typeof body.message === "string" ? body.message : "Could not read faucet status." };
  }
  const status = typeof body.status === "string" ? body.status : "";
  const txHash = typeof body.txHash === "string" ? body.txHash : "";
  if (status === "Done" && /^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { state: "confirmed", statusKey, txHash };
  }
  if (status === "Failed") {
    return { state: "failed", statusKey, message: "The faucet payout failed." } as FaucetOutcome;
  }
  return {
    state: "queued",
    statusKey,
    message: status === "Working"
      ? "The faucet is sending the payout. It is not confirmed on-chain yet."
      : "The faucet request is still queued.",
  };
}
