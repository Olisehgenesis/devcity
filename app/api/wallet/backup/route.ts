import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function isAddress(value: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(value);
}

// POST /api/wallet/backup — store an encrypted backup blob for the signed-in user.
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to back up a wallet.' }, { status: 401 });
    }

    const body = await request.json();
    const { address, iv, data, salt, iterations } = body;
    if (!address || !iv || !data || !salt) {
      return NextResponse.json({ error: 'Missing backup fields' }, { status: 400 });
    }
    const normalized = String(address).trim().toLowerCase();
    if (!isAddress(normalized)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const backup = await prisma.walletBackup.upsert({
      where: { address: normalized },
      create: {
        userId,
        address: normalized,
        iv: String(iv),
        data: String(data),
        salt: String(salt),
        iterations: Number(iterations) || 250000,
      },
      update: {
        // Re-bind to the current user so a re-import on a new device restores correctly.
        userId,
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

// GET /api/wallet/backup?address=0x... — look up a backup by address (owner only).
// GET /api/wallet/backup?userId=... — look up a backup by user id (used on new-device restore).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = String(searchParams.get('address') ?? '').trim().toLowerCase();
    const userId = String(searchParams.get('userId') ?? '').trim();

    const session = await auth.api.getSession({ headers: request.headers });
    const sessionUserId = session?.user?.id;

    if (!address && !userId) {
      return NextResponse.json({ error: 'Provide an address or userId' }, { status: 400 });
    }

    // Resolve the backup row, then enforce ownership.
    let backup;
    if (address) {
      if (!isAddress(address)) {
        return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
      }
      backup = await prisma.walletBackup.findUnique({ where: { address } });
    } else {
      if (!userId) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
      }
      backup = await prisma.walletBackup.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!backup) return NextResponse.json({ error: 'No backup found' }, { status: 404 });

    // Only the owner may read their own backup blob.
    if (sessionUserId && sessionUserId !== backup.userId) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    if (!sessionUserId) {
      return NextResponse.json({ error: 'You must be signed in to restore a wallet.' }, { status: 401 });
    }

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