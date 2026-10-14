import { NextResponse } from 'next/server';
import { createTip, listTips, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address') ?? '';
    const type = (url.searchParams.get('type') as 'sent' | 'received' | null) ?? 'sent';
    const tips = await listTips(address, type);
    return NextResponse.json({ tips });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/tips', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tip = await createTip({
      fromAddress: body.fromAddress,
      toAddress: body.toAddress,
      tokenSymbol: body.tokenSymbol,
      amount: body.amount,
      message: body.message,
    });
    return NextResponse.json({ tip }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/tips', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
