import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

/**
 * Upload media (images/videos) to cloud storage
 * Currently using a simple base64 approach - can be upgraded to Cloudinary/S3
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new ApiError(400, 'No file provided');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      throw new ApiError(400, 'Invalid file type. Only images (JPEG, PNG, WebP, GIF) and videos (MP4, WebM) are allowed.');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new ApiError(400, 'File too large. Maximum size is 10MB.');
    }

    // Convert file to base64 (for simplicity - can be upgraded to Cloudinary/S3)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // For production, upload to Cloudinary or S3 and return the URL
    // For now, return the data URL (suitable for development/small files)
    return NextResponse.json({
      url: dataUrl,
      type: file.type,
      size: file.size,
      name: file.name,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/upload', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
