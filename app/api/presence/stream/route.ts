import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events endpoint for real-time presence updates
 * Clients can subscribe to receive location updates from nearby users
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radiusKm = searchParams.get('radiusKm') || '1';

  if (!lat || !lng) {
    return new Response('lat and lng are required', { status: 400 });
  }

  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const { nearbyPresence } = await import('@/lib/db-helpers');

      // Send initial data
      try {
        const users = await nearbyPresence(Number(lat), Number(lng), Number(radiusKm));
        const data = `data: ${JSON.stringify({ type: 'initial', users })}\n\n`;
        controller.enqueue(encoder.encode(data));
      } catch (error) {
        console.error('Error fetching initial presence:', error);
      }

      // Set up periodic updates (every 10 seconds)
      const intervalId = setInterval(async () => {
        try {
          const users = await nearbyPresence(Number(lat), Number(lng), Number(radiusKm));
          const data = `data: ${JSON.stringify({ type: 'update', users })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          console.error('Error in presence stream:', error);
          const errorData = `data: ${JSON.stringify({ type: 'error', message: 'Failed to fetch updates' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        }
      }, 10000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
