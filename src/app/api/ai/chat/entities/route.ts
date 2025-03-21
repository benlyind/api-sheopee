import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { detectEntities } from '@/lib/ai';

// POST: Mendeteksi entitas dari pesan
async function detectMessageEntities(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    // Validasi input
    if (!message) {
      return NextResponse.json(
        { error: 'Parameter message diperlukan' },
        { status: 400 }
      );
    }

    // Deteksi entitas menggunakan fungsi dari lib/ai.ts
    const entities = await detectEntities(message);

    return NextResponse.json({ entities });
  } catch (error) {
    console.error('Error detecting entities:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendeteksi entitas' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(detectMessageEntities);
