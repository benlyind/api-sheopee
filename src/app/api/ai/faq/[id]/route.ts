import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { updateFAQVectorStore } from '@/lib/faq';

// GET: Mendapatkan detail FAQ berdasarkan ID
async function getFAQ(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID FAQ dari URL
    const pathname = request.nextUrl.pathname;
    const faqId = pathname.split('/').pop() || '';
    
    // Ambil storeId dari query parameter
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    
    // Validasi storeId
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke store ini
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', request.user.id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Ambil detail FAQ
    const { data: faq, error } = await supabase
      .from('faq_documents')
      .select('*')
      .eq('id', faqId)
      .eq('store_id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'FAQ tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ faq });
  } catch (error) {
    console.error('Error getting FAQ:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail FAQ' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui FAQ berdasarkan ID
async function updateFAQ(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID FAQ dari URL
    const pathname = request.nextUrl.pathname;
    const faqId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { question, answer, category, tags, storeId } = body;

    // Validasi input
    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Parameter question dan answer diperlukan' },
        { status: 400 }
      );
    }

    // Validasi storeId
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke store ini
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', request.user.id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Cek apakah FAQ ada dan milik toko yang benar
    const { data: existingFAQ, error: checkError } = await supabase
      .from('faq_documents')
      .select('id, store_id')
      .eq('id', faqId)
      .eq('store_id', storeId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'FAQ tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    // Perbarui FAQ
    const { data: updatedFAQ, error: updateError } = await supabase
      .from('faq_documents')
      .update({
        question,
        answer,
        category: category || 'general',
        tags: tags || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', faqId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update vector store untuk FAQ
    try {
      await updateFAQVectorStore(storeId);
    } catch (error) {
      console.error('Error updating FAQ vector store:', error);
      // Lanjutkan meskipun ada error pada vector store
    }

    return NextResponse.json({
      message: 'FAQ berhasil diperbarui',
      faq: updatedFAQ
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui FAQ' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus FAQ berdasarkan ID
async function deleteFAQ(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID FAQ dari URL
    const pathname = request.nextUrl.pathname;
    const faqId = pathname.split('/').pop() || '';
    
    // Ambil storeId dari query parameter
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    
    // Validasi storeId
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke store ini
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', request.user.id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Cek apakah FAQ ada dan milik toko yang benar
    const { data: existingFAQ, error: checkError } = await supabase
      .from('faq_documents')
      .select('id, store_id')
      .eq('id', faqId)
      .eq('store_id', storeId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'FAQ tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    // Hapus FAQ
    const { error: deleteError } = await supabase
      .from('faq_documents')
      .delete()
      .eq('id', faqId)
      .eq('store_id', storeId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Update vector store untuk FAQ
    try {
      await updateFAQVectorStore(storeId);
    } catch (error) {
      console.error('Error updating FAQ vector store:', error);
      // Lanjutkan meskipun ada error pada vector store
    }

    return NextResponse.json(
      { message: 'FAQ berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus FAQ' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getFAQ);
export const PUT = withAuth(updateFAQ);
export const DELETE = withAuth(deleteFAQ);
