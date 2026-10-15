import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userAddress, savedEvents, activity, preferences } = body;

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    // Update user settings
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        savedEvents: savedEvents || [],
        preferences: preferences || {},
        lastSyncedAt: new Date(),
      },
      update: {
        savedEvents: savedEvents !== undefined ? savedEvents : undefined,
        preferences: preferences !== undefined ? preferences : undefined,
        lastSyncedAt: new Date(),
      },
    });

    // Sync activity if provided
    if (activity && Array.isArray(activity)) {
      for (const item of activity) {
        await prisma.userActivity.upsert({
          where: { id: item.id || `${user.id}_${item.kind}_${item.timestamp}` },
          create: {
            id: item.id || `${user.id}_${item.kind}_${item.timestamp}`,
            userId: user.id,
            kind: item.kind,
            text: item.text,
            refId: item.refId,
            timestamp: new Date(item.timestamp),
          },
          update: {
            kind: item.kind,
            text: item.text,
            refId: item.refId,
          },
        });
      }
    }

    // Fetch latest data from server
    const serverSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    const serverActivity = await prisma.userActivity.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      settings: serverSettings,
      activity: serverActivity.map((a) => ({
        id: a.id,
        kind: a.kind,
        text: a.text,
        refId: a.refId,
        timestamp: a.timestamp.toISOString(),
      })),
      lastSyncedAt: settings.lastSyncedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/sync', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    const [settings, activity] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId: user.id },
      }),
      prisma.userActivity.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    return NextResponse.json({
      settings: settings || null,
      activity: activity.map((a) => ({
        id: a.id,
        kind: a.kind,
        text: a.text,
        refId: a.refId,
        timestamp: a.timestamp.toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/sync', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
