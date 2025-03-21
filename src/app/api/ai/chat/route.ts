import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { getAiResponseWithAgent, analyzeIntentWithLangChain, detectEntities } from '@/lib/ai';

// POST: Mendapatkan respons AI untuk pesan pengguna
async function getAIResponse(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { message, userId, storeId, productId, promptName, humanPrompt } = body;

    // Validasi input
    if (!message) {
      return NextResponse.json(
        { error: 'Parameter message diperlukan' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Parameter userId diperlukan' },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }

    // Dapatkan respons AI menggunakan fungsi dari lib/ai.ts
    const response = await getAiResponseWithAgent(
      message,
      userId,
      storeId,
      promptName || 'default',
      productId,
      undefined, // customerId (opsional)
      humanPrompt // parameter tambahan untuk human prompt
    );

    return NextResponse.json({
      response,
      sessionId: productId ? `${userId}-${productId}` : userId
    });
  } catch (error) {
    console.error('Error getting AI response:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendapatkan respons AI' },
      { status: 500 }
    );
  }
}

// GET: Mendapatkan riwayat chat
async function getChatHistory(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '50') : 50;

    // Validasi input
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Parameter sessionId diperlukan' },
        { status: 400 }
      );
    }

    // Ambil riwayat chat
    const { data: chatHistory, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ chatHistory });
  } catch (error) {
    console.error('Error getting chat history:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil riwayat chat' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus riwayat chat
async function deleteChatHistory(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    // Validasi input
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Parameter sessionId diperlukan' },
        { status: 400 }
      );
    }

    // Hapus riwayat chat
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Riwayat chat berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus riwayat chat' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(getAIResponse);
export const GET = withAuth(getChatHistory);
export const DELETE = withAuth(deleteChatHistory);
