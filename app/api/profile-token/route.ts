import { NextResponse } from 'next/server';
import { recordProfileToken, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.creatorAddress || !body.name || !body.symbol || !body.contractAddress) {
      return NextResponse.json({ error: 'Missing token fields' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(body.contractAddress))) {
      return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
    }
    const token = await recordProfileToken({
      creatorAddress: String(body.creatorAddress),
      name: String(body.name).slice(0, 64),
      symbol: String(body.symbol).slice(0, 16).toUpperCase(),
      contractAddress: String(body.contractAddress),
      chainId: Number(body.chainId) || 0,
      maxSupply: String(body.maxSupply ?? '0'),
    });
    return NextResponse.json({ token }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/profile-token', err);
    return NextResponse.json({ error: 'Could not record token' }, { status: 500 });
  }
}
