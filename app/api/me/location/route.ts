import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { setLocationSharing, validCoordinate } from '@/lib/location-sharing';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Sign in to change location sharing.' }, { status: 401 });
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { locationSharing: true } });
  return NextResponse.json({ sharing: profile?.locationSharing ?? true });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Sign in to change location sharing.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { sharing?: boolean; latitude?: number; longitude?: number } | null;
  if (typeof body?.sharing !== 'boolean') {
    return NextResponse.json({ error: 'Say whether location sharing is on.' }, { status: 400 });
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const point = validCoordinate(latitude, longitude) ? { latitude, longitude } : undefined;
  const result = await setLocationSharing(userId, body.sharing, point);
  return NextResponse.json(result);
}
