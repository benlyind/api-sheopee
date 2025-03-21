import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail produk berdasarkan ID
async function getProduct(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID produk dari URL
    const pathname = request.nextUrl.pathname;
    const productId = pathname.split('/').pop() || '';

    // Ambil detail produk
    const { data: product, error } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('product_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error getting product:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail produk' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui produk berdasarkan ID
async function updateProduct(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID produk dari URL
    const pathname = request.nextUrl.pathname;
    const productId = pathname.split('/').pop() || '';
    const body = await request.json();
    const { name, description, variants } = body;

    // Validasi input
    if (!name) {
      return NextResponse.json(
        { error: 'Parameter name diperlukan' },
        { status: 400 }
      );
    }

    // Perbarui produk
    const { data: updatedProduct, error: productError } = await supabase
      .from('products')
      .update({
        name,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .select()
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

    // Jika ada variants, perbarui atau tambahkan ke tabel product_variants
    if (variants && variants.length > 0) {
      // Hapus varian yang ada
      await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', productId);

      // Tambahkan varian baru
      const variantsToInsert = variants.map((variant: any) => ({
        variant_id: variant.variantId,
        product_id: productId,
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
        return NextResponse.json(
          { error: variantsError.message },
          { status: 500 }
        );
      }

      // Return produk dengan varian
      return NextResponse.json({
        ...updatedProduct,
        product_variants: insertedVariants,
      });
    }

    // Return produk tanpa varian
    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui produk' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus produk berdasarkan ID
async function deleteProduct(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID produk dari URL
    const pathname = request.nextUrl.pathname;
    const productId = pathname.split('/').pop() || '';

    // Hapus varian produk terlebih dahulu
    await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId);

    // Hapus produk
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('product_id', productId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Produk berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProduct);
export const PUT = withAuth(updateProduct);
export const DELETE = withAuth(deleteProduct);
