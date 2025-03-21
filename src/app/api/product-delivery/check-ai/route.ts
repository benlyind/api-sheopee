import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mengecek status useAi berdasarkan product_id
async function checkProductAi(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('product_id');
    const variantId = searchParams.get('variant_id');

    console.log(`Checking AI status for product_id: ${productId || 'undefined'}, variant_id: ${variantId || 'null'}`);

    // Validasi input
    if (!productId || productId.trim() === '') {
      console.log('Missing or empty product_id parameter');
      return NextResponse.json({ useAi: null });
    }

    // Cek langsung di tabel product_delivery_config tanpa filter variant_id
    const { data: allConfigs, error: allConfigsError } = await supabase
      .from('product_delivery_config')
      .select('*')
      .eq('product_id', productId);
    
    console.log(`All configs for product ${productId}:`, JSON.stringify(allConfigs));
    
    if (allConfigsError) {
      console.log(`Error fetching all configs: ${allConfigsError.message}`);
      return NextResponse.json(
        { error: allConfigsError.message },
        { status: 500 }
      );
    }

    // Jika tidak ada konfigurasi yang ditemukan
    if (!allConfigs || allConfigs.length === 0) {
      console.log('No delivery config found, returning useAi: false');
      return NextResponse.json({ useAi: false });
    }

    // Cari konfigurasi yang sesuai dengan variant_id
    let config = null;
    if (variantId) {
      config = allConfigs.find(c => c.variant_id === variantId);
    } else {
      config = allConfigs.find(c => c.variant_id === null);
    }

    // Jika tidak ada konfigurasi yang sesuai, gunakan konfigurasi pertama
    if (!config && allConfigs.length > 0) {
      config = allConfigs[0];
    }

    // Jika masih tidak ada konfigurasi, kembalikan false
    if (!config) {
      return NextResponse.json({ useAi: false });
    }

    console.log(`Selected config:`, JSON.stringify(config));
    console.log(`Raw use_ai value: ${config.use_ai}, type: ${typeof config.use_ai}`);
    
    return NextResponse.json({ useAi: config.use_ai });
  } catch (error) {
    console.error('Error checking product AI status:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengecek status AI produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(checkProductAi);
