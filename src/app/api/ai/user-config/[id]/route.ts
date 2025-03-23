import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail konfigurasi AI berdasarkan ID
async function getAIConfigById(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID konfigurasi dari URL
    const pathname = request.nextUrl.pathname;
    const configId = pathname.split('/').pop() || '';

    // Ambil detail konfigurasi
    const { data: config, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('id', configId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Konfigurasi AI tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa konfigurasi milik user yang terautentikasi
    if (config.user_id !== request.user.id) {
      return NextResponse.json(
        { success: false, error: 'Tidak memiliki akses ke konfigurasi AI ini' },
        { status: 403 }
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
    console.error('Error getting AI config by ID:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mengambil detail konfigurasi AI' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui konfigurasi AI berdasarkan ID
async function updateAIConfig(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID konfigurasi dari URL
    const pathname = request.nextUrl.pathname;
    const configId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { systemPrompt, customPrompts } = body;

    // Validasi input
    if (!systemPrompt) {
      return NextResponse.json(
        { success: false, error: 'Parameter systemPrompt diperlukan' },
        { status: 400 }
      );
    }

    if (!customPrompts || typeof customPrompts !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Parameter customPrompts diperlukan dan harus berupa objek' },
        { status: 400 }
      );
    }

    // Cek apakah konfigurasi ada
    const { data: existingConfig, error: checkError } = await supabase
      .from('ai_config')
      .select('user_id')
      .eq('id', configId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Konfigurasi AI tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: checkError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa konfigurasi milik user yang terautentikasi
    if (existingConfig.user_id !== request.user.id) {
      return NextResponse.json(
        { success: false, error: 'Tidak memiliki akses ke konfigurasi AI ini' },
        { status: 403 }
      );
    }

    // Perbarui konfigurasi
    const { data: updatedConfig, error: updateError } = await supabase
      .from('ai_config')
      .update({
        system_prompt: systemPrompt,
        custom_prompts: customPrompts,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        id: updatedConfig.id,
        systemPrompt: updatedConfig.system_prompt,
        customPrompts: updatedConfig.custom_prompts,
        createdAt: updatedConfig.created_at,
        updatedAt: updatedConfig.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat memperbarui konfigurasi AI' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus konfigurasi AI berdasarkan ID
async function deleteAIConfig(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID konfigurasi dari URL
    const pathname = request.nextUrl.pathname;
    const configId = pathname.split('/').pop() || '';

    // Cek apakah konfigurasi ada
    const { data: existingConfig, error: checkError } = await supabase
      .from('ai_config')
      .select('user_id')
      .eq('id', configId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Konfigurasi AI tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: checkError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa konfigurasi milik user yang terautentikasi
    if (existingConfig.user_id !== request.user.id) {
      return NextResponse.json(
        { success: false, error: 'Tidak memiliki akses ke konfigurasi AI ini' },
        { status: 403 }
      );
    }

    // Hapus konfigurasi
    const { error: deleteError } = await supabase
      .from('ai_config')
      .delete()
      .eq('id', configId);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
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

export const GET = withAuth(getAIConfigById);
export const PUT = withAuth(updateAIConfig);
export const DELETE = withAuth(deleteAIConfig);
