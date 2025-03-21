import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

// GET: Mendapatkan detail konfigurasi pengiriman produk berdasarkan ID
async function getProductDelivery(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID konfigurasi dari URL
    const pathname = request.nextUrl.pathname;
    const configId = pathname.split('/').pop() || '';

    // Ambil detail konfigurasi
    const { data: config, error } = await supabase
      .from('product_delivery_config')
      .select('*, template:delivery_templates(*), store:stores(user_id)')
      .eq('id', configId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Konfigurasi pengiriman produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa konfigurasi milik user yang terautentikasi
    if (config.store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke konfigurasi pengiriman produk ini' },
        { status: 403 }
      );
    }

    // Hapus informasi store.user_id dari respons
    delete config.store;

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error getting product delivery config:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail konfigurasi pengiriman produk' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui konfigurasi pengiriman produk berdasarkan ID
async function updateProductDelivery(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID konfigurasi dari URL
    const pathname = request.nextUrl.pathname;
    const configId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { type, status, accountData, templateId, useAi, templateContent, templateName } = body;

    // Validasi input
    if (!type) {
      return NextResponse.json(
        { error: 'Parameter type diperlukan' },
        { status: 400 }
      );
    }

    // Ambil detail konfigurasi untuk verifikasi akses
    const { data: config, error: configError } = await supabase
      .from('product_delivery_config')
      .select('store_id')
      .eq('id', configId)
      .single();

    if (configError) {
      if (configError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Konfigurasi pengiriman produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: configError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa konfigurasi milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', config.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke konfigurasi pengiriman produk ini' },
        { status: 403 }
      );
    }

    // Jika templateContent dan templateName diberikan, buat template baru
    let finalTemplateId = templateId;
    if (templateContent && templateName && !templateId) {
      // Generate UUID untuk template
      const newTemplateId = uuidv4();

      // Buat template baru
      const { data: template, error: templateError } = await supabase
        .from('delivery_templates')
        .insert([
          {
            id: newTemplateId,
            store_id: config.store_id,
            name: templateName,
            content: templateContent,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (templateError) {
        return NextResponse.json(
          { error: templateError.message },
          { status: 500 }
        );
      }

      finalTemplateId = newTemplateId;
    }

    // Perbarui konfigurasi
    const { data: updatedConfig, error: updateError } = await supabase
      .from('product_delivery_config')
      .update({
        type,
        status: status || 'active',
        account_data: accountData,
        template_id: finalTemplateId,
        use_ai: useAi !== undefined ? useAi : false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId)
      .select('*, template:delivery_templates(*)')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error('Error updating product delivery config:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui konfigurasi pengiriman produk' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus konfigurasi pengiriman produk berdasarkan ID
async function deleteProductDelivery(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID konfigurasi dari URL
    const pathname = request.nextUrl.pathname;
    const configId = pathname.split('/').pop() || '';

    // Ambil detail konfigurasi untuk verifikasi akses
    const { data: config, error: configError } = await supabase
      .from('product_delivery_config')
      .select('store_id')
      .eq('id', configId)
      .single();

    if (configError) {
      if (configError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Konfigurasi pengiriman produk tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: configError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa konfigurasi milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', config.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke konfigurasi pengiriman produk ini' },
        { status: 403 }
      );
    }

    // Hapus konfigurasi
    const { error: deleteError } = await supabase
      .from('product_delivery_config')
      .delete()
      .eq('id', configId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Konfigurasi pengiriman produk berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting product delivery config:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus konfigurasi pengiriman produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProductDelivery);
export const PUT = withAuth(updateProductDelivery);
export const DELETE = withAuth(deleteProductDelivery);
