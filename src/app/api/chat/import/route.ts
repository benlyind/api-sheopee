import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { importChatHistoryToNeo4j } from '@/lib/importHistory';
import { supabase } from '@/lib/supabase';

// POST: Mengimpor riwayat chat ke Neo4j
async function importChatHistory(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { storeId, chatHistory } = body;

    // Validasi input dasar
    if (!storeId || !chatHistory || !Array.isArray(chatHistory)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Data tidak valid. Diperlukan storeId dan chatHistory array.'
        },
        { status: 400 }
      );
    }

    // Validasi format setiap sesi chat
    for (const chat of chatHistory) {
      // Validasi sessionId
      if (!chat.sessionId || !chat.messages || !Array.isArray(chat.messages)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Format data tidak valid. Setiap item harus memiliki sessionId dan array messages.'
          },
          { status: 400 }
        );
      }

      // Validasi setiap pesan dalam sesi
      for (const message of chat.messages) {
        if (!message.role || !message.content || !message.timestamp) {
          return NextResponse.json(
            {
              success: false,
              message: 'Format pesan tidak valid. Setiap pesan harus memiliki role, content, dan timestamp.'
            },
            { status: 400 }
          );
        }

        if (!['human', 'assistant'].includes(message.role)) {
          return NextResponse.json(
            {
              success: false,
              message: 'Role pesan harus berupa "human" atau "assistant".'
            },
            { status: 400 }
          );
        }
      }
    }

    // Verifikasi toko
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        {
          success: false,
          message: 'Toko tidak ditemukan.'
        },
        { status: 404 }
      );
    }

    // Verifikasi kepemilikan toko
    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Tidak memiliki akses ke toko ini.'
        },
        { status: 403 }
      );
    }

    // Lakukan impor ke Neo4j
    const result = await importChatHistoryToNeo4j(storeId, chatHistory);

    return NextResponse.json(
      result,
      { status: result.success ? 200 : 500 }
    );

  } catch (error) {
    console.error('Error dalam endpoint import:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Terjadi kesalahan internal server.'
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(importChatHistory); 