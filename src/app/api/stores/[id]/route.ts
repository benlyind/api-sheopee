import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail toko berdasarkan ID
async function getStore(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID toko dari URL
    const pathname = request.nextUrl.pathname;
    const storeId = pathname.split('/').pop() || '';

    // Ambil detail toko berdasarkan id
    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Toko tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa toko milik user yang terautentikasi
    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    return NextResponse.json({ store });
  } catch (error) {
    console.error('Error getting store:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail toko' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui toko berdasarkan ID
async function updateStore(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID toko dari URL
    const pathname = request.nextUrl.pathname;
    const storeId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { name, description, logoUrl } = body;

    // Validasi input
    if (!name) {
      return NextResponse.json(
        { error: 'Nama toko diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa toko milik user yang terautentikasi
    const { data: existingStore, error: fetchError } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Toko tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (existingStore.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Perbarui toko
    const { data: updatedStore, error: updateError } = await supabase
      .from('stores')
      .update({
        name,
        description,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedStore);
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui toko' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus toko berdasarkan ID
async function deleteStore(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID toko dari URL
    const pathname = request.nextUrl.pathname;
    const storeId = pathname.split('/').pop() || '';

    // Verifikasi bahwa toko milik user yang terautentikasi
    const { data: existingStore, error: fetchError } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Toko tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (existingStore.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Hapus toko
    const { error: deleteError } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Toko berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus toko' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getStore);
export const PUT = withAuth(updateStore);
export const DELETE = withAuth(deleteStore);
