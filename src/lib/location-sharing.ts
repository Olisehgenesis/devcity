import { prisma } from './prisma';

export function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export async function setLocationSharing(userId: string, sharing: boolean, point?: { latitude: number; longitude: number }) {
  await prisma.profile.updateMany({ where: { userId }, data: { locationSharing: sharing } });
  if (!sharing) {
    await prisma.presence.updateMany({
      where: { userId },
      data: { visibility: 'INVISIBLE', status: 'OFFLINE' },
    });
    return { sharing: false };
  }
  if (point && validCoordinate(point.latitude, point.longitude)) {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.presence.upsert({
      where: { userId },
      create: {
        userId,
        latitude: point.latitude,
        longitude: point.longitude,
        visibility: 'APPROXIMATE',
        status: 'ONLINE',
        expiresAt,
      },
      update: {
        latitude: point.latitude,
        longitude: point.longitude,
        visibility: 'APPROXIMATE',
        status: 'ONLINE',
        expiresAt,
      },
    });
  }
  return { sharing: true };
}
