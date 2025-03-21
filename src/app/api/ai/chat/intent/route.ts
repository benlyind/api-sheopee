import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { analyzeIntentWithLangChain } from '@/lib/ai';

// POST: Menganalisis intent dari pesan
async function analyzeIntent(request: AuthenticatedRequest) {
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

    // Analisis intent menggunakan fungsi dari lib/ai.ts
    const intent = await analyzeIntentWithLangChain(message);

    return NextResponse.json({ intent });
  } catch (error) {
    console.error('Error analyzing intent:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menganalisis intent' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(analyzeIntent);
