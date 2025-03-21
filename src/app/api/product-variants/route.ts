import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan semua varian produk berdasarkan product_id
async function getProductVariants(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('product_id');

    // Validasi input
    if (!productId) {
      return NextResponse.json(
        { error: 'Parameter product_id diperlukan' },
        { status: 400 }
      );
    }

    // Ambil detail produk untuk verifikasi akses
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('store_id')
      .eq('product_id', productId)
      .single();

    if (productError) {
      if (productError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: productError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa produk milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', product.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke produk ini' },
        { status: 403 }
      );
    }

    // Ambil semua varian untuk produk tertentu
    const { data: variants, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ variants });
  } catch (error) {
    console.error('Error getting product variants:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data varian produk' },
      { status: 500 }
    );
  }
}

// POST: Membuat varian produk baru
async function createProductVariant(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { productId, variantId, name, price, isActive } = body;

    // Validasi input
    if (!productId || !variantId || !name || price === undefined) {
      return NextResponse.json(
        { error: 'Parameter product_id, variant_id, name, dan price diperlukan' },
        { status: 400 }
      );
    }

    // Ambil detail produk untuk verifikasi akses
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('store_id')
      .eq('product_id', productId)
      .single();

    if (productError) {
      if (productError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: productError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa produk milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', product.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke produk ini' },
        { status: 403 }
      );
    }

    // Buat varian produk baru
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .insert([
        {
          variant_id: variantId,
          product_id: productId,
          name,
          price,
          is_active: isActive !== undefined ? isActive : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (variantError) {
      return NextResponse.json(
        { error: variantError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(variant, { status: 201 });
  } catch (error) {
    console.error('Error creating product variant:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat varian produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProductVariants);
export const POST = withAuth(createProductVariant);
