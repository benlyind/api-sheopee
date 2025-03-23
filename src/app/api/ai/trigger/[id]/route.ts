import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail AI trigger berdasarkan ID
async function getAITriggerById(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID trigger dari URL
    const pathname = request.nextUrl.pathname;
    const triggerId = parseInt(pathname.split('/').pop() || '0');

    if (isNaN(triggerId) || triggerId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID trigger tidak valid' },
        { status: 400 }
      );
    }

    // Ambil detail trigger
    const { data: trigger, error } = await supabase
      .from('ai_trigger')
      .select('*')
      .eq('id', triggerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'AI trigger tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa trigger milik user yang terautentikasi
    if (trigger.user_id !== request.user.id) {
      return NextResponse.json(
        { success: false, error: 'Tidak memiliki akses ke AI trigger ini' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      trigger: {
        id: trigger.id,
        intent: trigger.Intent,
        keywords: trigger.Keywords,
        template: trigger.Template
      }
    });
  } catch (error) {
    console.error('Error getting AI trigger by ID:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mengambil detail AI trigger' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui AI trigger berdasarkan ID
async function updateAITrigger(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID trigger dari URL
    const pathname = request.nextUrl.pathname;
    const triggerId = parseInt(pathname.split('/').pop() || '0');
    
    if (isNaN(triggerId) || triggerId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID trigger tidak valid' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { intent, keywords, template } = body;

    // Validasi input
    if (template !== undefined && typeof template !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parameter template harus berupa string' },
        { status: 400 }
      );
    }

    if (keywords !== undefined && !Array.isArray(keywords)) {
      return NextResponse.json(
        { success: false, error: 'Parameter keywords harus berupa array' },
        { status: 400 }
      );
    }

    // Cek apakah trigger ada dan milik user yang terautentikasi
    const { data: existingTrigger, error: checkError } = await supabase
      .from('ai_trigger')
      .select('*')
      .eq('id', triggerId)
      .eq('user_id', request.user.id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'AI trigger tidak ditemukan atau Anda tidak memiliki akses' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: checkError.message },
        { status: 500 }
      );
    }

    // Perbarui trigger
    const { data: updatedTrigger, error: updateError } = await supabase
      .from('ai_trigger')
      .update({
        Intent: intent !== undefined ? intent : existingTrigger.Intent,
        Keywords: keywords !== undefined ? keywords : existingTrigger.Keywords,
        Template: template !== undefined ? template : existingTrigger.Template
      })
      .eq('id', triggerId)
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
      trigger: {
        id: updatedTrigger.id,
        intent: updatedTrigger.Intent,
        keywords: updatedTrigger.Keywords,
        template: updatedTrigger.Template
      }
    });
  } catch (error) {
    console.error('Error updating AI trigger:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat memperbarui AI trigger' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus AI trigger berdasarkan ID
async function deleteAITrigger(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID trigger dari URL
    const pathname = request.nextUrl.pathname;
    const triggerId = parseInt(pathname.split('/').pop() || '0');

    if (isNaN(triggerId) || triggerId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID trigger tidak valid' },
        { status: 400 }
      );
    }

    // Cek apakah trigger ada dan milik user yang terautentikasi
    const { data: existingTrigger, error: checkError } = await supabase
      .from('ai_trigger')
      .select('*')
      .eq('id', triggerId)
      .eq('user_id', request.user.id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'AI trigger tidak ditemukan atau Anda tidak memiliki akses' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: checkError.message },
        { status: 500 }
      );
    }

    // Hapus trigger
    const { error: deleteError } = await supabase
      .from('ai_trigger')
      .delete()
      .eq('id', triggerId);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'AI trigger berhasil dihapus'
    });
  } catch (error) {
    console.error('Error deleting AI trigger:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat menghapus AI trigger' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAITriggerById);
export const PUT = withAuth(updateAITrigger);
export const DELETE = withAuth(deleteAITrigger);
