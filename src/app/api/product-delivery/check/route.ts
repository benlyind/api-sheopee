import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mengecek data product delivery berdasarkan store_id dan variant_id/product_id
async function checkProductDelivery(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    const variantId = searchParams.get('variant_id');
    const productId = searchParams.get('product_id');

    // Validasi input
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter store_id diperlukan' },
        { status: 400 }
      );
    }

    if (!variantId && !productId) {
      return NextResponse.json(
        { error: 'Parameter variant_id atau product_id diperlukan' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('product_delivery_config')
      .select('*, delivery_templates(id, name, content)')
      .eq('store_id', storeId);

    // Jika variant_id tersedia, gunakan variant_id
    if (variantId) {
      query = query.eq('variant_id', variantId);
    } 
    // Jika tidak, gunakan product_id
    else if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Data tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error checking product delivery:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengecek data product delivery' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(checkProductDelivery);
