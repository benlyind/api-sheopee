import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail varian produk berdasarkan ID
async function getProductVariant(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID varian dari URL
    const pathname = request.nextUrl.pathname;
    const variantId = pathname.split('/').pop() || '';

    // Ambil detail varian
    const { data: variant, error } = await supabase
      .from('product_variants')
      .select('*, products!inner(*)')
      .eq('variant_id', variantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Varian produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa produk milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', variant.products.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke varian produk ini' },
        { status: 403 }
      );
    }

    return NextResponse.json({ variant });
  } catch (error) {
    console.error('Error getting product variant:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail varian produk' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui varian produk berdasarkan ID
async function updateProductVariant(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID varian dari URL
    const pathname = request.nextUrl.pathname;
    const variantId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { name, price, isActive } = body;

    // Validasi input
    if (!name || price === undefined) {
      return NextResponse.json(
        { error: 'Parameter name dan price diperlukan' },
        { status: 400 }
      );
    }

    // Ambil detail varian untuk verifikasi akses
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .select('*, products!inner(store_id)')
      .eq('variant_id', variantId)
      .single();

    if (variantError) {
      if (variantError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Varian produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: variantError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa produk milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', variant.products.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke varian produk ini' },
        { status: 403 }
      );
    }

    // Perbarui varian produk
    const { data: updatedVariant, error: updateError } = await supabase
      .from('product_variants')
      .update({
        name,
        price,
        is_active: isActive !== undefined ? isActive : true,
        updated_at: new Date().toISOString(),
      })
      .eq('variant_id', variantId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedVariant);
  } catch (error) {
    console.error('Error updating product variant:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui varian produk' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus varian produk berdasarkan ID
async function deleteProductVariant(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID varian dari URL
    const pathname = request.nextUrl.pathname;
    const variantId = pathname.split('/').pop() || '';

    // Ambil detail varian untuk verifikasi akses
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .select('*, products!inner(store_id)')
      .eq('variant_id', variantId)
      .single();

    if (variantError) {
      if (variantError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Varian produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: variantError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa produk milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', variant.products.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke varian produk ini' },
        { status: 403 }
      );
    }

    // Hapus varian produk
    const { error: deleteError } = await supabase
      .from('product_variants')
      .delete()
      .eq('variant_id', variantId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Varian produk berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting product variant:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus varian produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProductVariant);
export const PUT = withAuth(updateProductVariant);
export const DELETE = withAuth(deleteProductVariant);
