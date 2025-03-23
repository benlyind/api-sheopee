import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

// GET: Mendapatkan konfigurasi AI berdasarkan user_id
async function getUserAIConfig(request: AuthenticatedRequest) {
  try {
    // Ambil konfigurasi AI dari database berdasarkan user_id
    const { data: config, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('user_id', request.user.id)
      .single();

    if (error) {
      console.error('Error getting AI config:', error);
      // Jika tidak ada konfigurasi, kembalikan default
      if (error.code === 'PGRST116') {
        const defaultConfig = {
          systemPrompt: "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
          customPrompts: {
            "default": "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
            "formal": "Anda adalah asisten penjual profesional yang memberikan informasi dengan bahasa formal dan sopan.",
            "casual": "Kamu adalah asisten penjual yang ramah dan menggunakan bahasa santai untuk membantu pelanggan."
          }
        };
        return NextResponse.json({
          success: true,
          config: defaultConfig,
          isDefault: true
        });
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        systemPrompt: config.system_prompt,
        customPrompts: config.custom_prompts,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }
    });
  } catch (error) {
    console.error('Error getting AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mengambil konfigurasi AI' },
      { status: 500 }
    );
  }
}

// POST: Menyimpan konfigurasi AI
async function saveUserAIConfig(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { systemPrompt, customPrompts } = body;

    if (!customPrompts || typeof customPrompts !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Parameter customPrompts diperlukan dan harus berupa objek' },
        { status: 400 }
      );
    }

    // Cek apakah konfigurasi sudah ada untuk user ini
    const { data: existingConfig, error: checkError } = await supabase
      .from('ai_config')
      .select('id')
      .eq('user_id', request.user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { success: false, error: checkError.message },
        { status: 500 }
      );
    }

    let result;
    if (existingConfig) {
      // Update konfigurasi yang ada
      const { data, error } = await supabase
        .from('ai_config')
        .update({
          system_prompt: systemPrompt,
          custom_prompts: customPrompts,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Buat konfigurasi baru
      const { data, error } = await supabase
        .from('ai_config')
        .insert([
          {
            id: uuidv4(),
            user_id: request.user.id,
            system_prompt: systemPrompt,
            custom_prompts: customPrompts,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({
      success: true,
      config: {
        id: result.id,
        systemPrompt: result.system_prompt,
        customPrompts: result.custom_prompts,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }
    });
  } catch (error) {
    console.error('Error saving AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat menyimpan konfigurasi AI' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus konfigurasi AI
async function deleteUserAIConfig(request: AuthenticatedRequest) {
  try {
    // Hapus konfigurasi AI berdasarkan user_id
    const { error } = await supabase
      .from('ai_config')
      .delete()
      .eq('user_id', request.user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi AI berhasil dihapus'
    });
  } catch (error) {
    console.error('Error deleting AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat menghapus konfigurasi AI' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getUserAIConfig);
export const POST = withAuth(saveUserAIConfig);
export const DELETE = withAuth(deleteUserAIConfig);
