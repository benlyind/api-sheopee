import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan semua produk berdasarkan store_id
async function getProducts(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');

    // Validasi input
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter store_id diperlukan' },
        { status: 400 }
      );
    }

    // Ambil semua produk untuk store tertentu
    const { data: products, error } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('store_id', storeId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error getting products:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data produk' },
      { status: 500 }
    );
  }
}

// POST: Membuat produk baru
async function createProduct(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { storeId, productId, name, description, variants } = body;

    // Validasi input
    if (!storeId || !productId || !name) {
      return NextResponse.json(
        { error: 'Parameter store_id, product_id, dan name diperlukan' },
        { status: 400 }
      );
    }

    // Buat produk baru
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([
        {
          product_id: productId,
          store_id: storeId,
          name,
          description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (productError) {
      return NextResponse.json(
        { error: productError.message },
        { status: 500 }
      );
    }

    // Jika ada variants, tambahkan ke tabel product_variants
    if (variants && variants.length > 0) {
      const variantsToInsert = variants.map((variant: any) => ({
        variant_id: variant.variantId,
        product_id: product.product_id,
        name: variant.name,
        price: variant.price,
        is_active: variant.isActive !== undefined ? variant.isActive : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: insertedVariants, error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert)
        .select();

      if (variantsError) {
        // Rollback: hapus produk jika gagal menambahkan varian
        await supabase.from('products').delete().eq('product_id', product.product_id);
        
        return NextResponse.json(
          { error: variantsError.message },
          { status: 500 }
        );
      }

      // Return produk dengan varian
      return NextResponse.json(
        { 
          ...product, 
          product_variants: insertedVariants 
        }, 
        { status: 201 }
      );
    }

    // Return produk tanpa varian
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProducts);
export const POST = withAuth(createProduct);
