import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { getAiResponseWithAgent, analyzeIntentWithLangChain, detectEntities, getAIConfig } from '@/lib/ai';
import { createTracingCallbacks } from '@/lib/langchain-tracer';

// POST: Mendapatkan respons AI untuk pesan pengguna
async function getAIResponse(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    
    const { message, sessionId, storeId, productId, promptName, humanPrompt } = body;
    
    // Gunakan ID pengguna dari token yang sudah diverifikasi
    const authenticatedUserId = request.user.id;

    // Validasi input
    if (!message) {
      return NextResponse.json(
        { error: 'Parameter message diperlukan' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Parameter sessionId diperlukan' },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }
    
    // 1. Ambil konfigurasi AI menggunakan ID pengguna yang terautentikasi
    const config = await getAIConfig(authenticatedUserId);
    
    // 2. Dapatkan prompt yang sesuai berdasarkan promptName
    const PromptName = promptName && config.customPrompts?.[promptName] 
      ? promptName 
      : 'default';
    const prompt = config.customPrompts?.[PromptName] || config.systemPrompt;
    
    // Buat tracing callbacks untuk LangSmith
    const callbacks = createTracingCallbacks(`chat_api_${sessionId}`, {
      userId: authenticatedUserId,
      sessionId,
      storeId,
      productId,
      promptName: PromptName,
      messageType: "user_message",
      endpoint: "/api/ai/chat"
    });
    
    // 3. Panggil getAiResponseWithAgent dengan parameter yang sesuai
    const response = await getAiResponseWithAgent(
      message,
      sessionId, // sessionId dari frontend
      storeId,
      PromptName,
      productId,
      undefined, // customerId (opsional)
      humanPrompt, // parameter tambahan untuk human prompt
      config // Teruskan konfigurasi AI yang sudah diambil
    );
    
    return NextResponse.json({
      response,
      sessionId: productId ? `${sessionId}-${productId}` : sessionId
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
