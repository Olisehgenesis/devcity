import { NextResponse } from 'next/server';
import { DEV_TEST_FAR, DEV_TEST_NEAR, DEV_TEST_PLACES, devLocationMockEnabled } from '@/lib/dev-location';
import { requestHostIsLocal } from '@/lib/dev-test-auth';

export async function GET(request: Request) {
  if (!devLocationMockEnabled() || !requestHostIsLocal(request)) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({
    enabled: true,
    label: 'TEST',
    near: DEV_TEST_NEAR,
    far: DEV_TEST_FAR,
    places: DEV_TEST_PLACES,
  });
}
