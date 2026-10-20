import { ApiError } from './api-error';

const ADDRESS = /^0x[0-9a-f]{40}$/;

export function normalizeWalletAddress(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError(400, 'A wallet address is required.');
  const address = value.trim().toLowerCase();
  if (!ADDRESS.test(address)) throw new ApiError(400, 'That wallet address is not valid.');
  return address;
}
