import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, iv, data, salt, iterations } = body;
    if (!address || !iv || !data || !salt) {
      return NextResponse.json({ error: 'Missing backup fields' }, { status: 400 });
    }
    const normalized = String(address).trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }
    const backup = await prisma.walletBackup.upsert({
      where: { address: normalized },
      create: {
        address: normalized,
        iv: String(iv),
        data: String(data),
        salt: String(salt),
        iterations: Number(iterations) || 250000,
      },
      update: {
        iv: String(iv),
        data: String(data),
        salt: String(salt),
        iterations: Number(iterations) || 250000,
      },
    });
    return NextResponse.json({ ok: true, ref: backup.id });
  } catch (error) {
    console.error('POST /api/wallet/backup', error);
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = String(searchParams.get('address') ?? '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }
    const backup = await prisma.walletBackup.findUnique({ where: { address } });
    if (!backup) return NextResponse.json({ error: 'No backup found' }, { status: 404 });
    return NextResponse.json({
      address: backup.address,
      iv: backup.iv,
      data: backup.data,
      salt: backup.salt,
      iterations: backup.iterations,
    });
  } catch (error) {
    console.error('GET /api/wallet/backup', error);
    return NextResponse.json({ error: 'Backup lookup failed' }, { status: 500 });
  }
}
