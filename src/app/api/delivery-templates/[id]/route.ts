import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail template pengiriman berdasarkan ID
async function getDeliveryTemplate(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID template dari URL
    const pathname = request.nextUrl.pathname;
    const templateId = pathname.split('/').pop() || '';

    // Ambil detail template
    const { data: template, error } = await supabase
      .from('delivery_templates')
      .select('*, store:stores(user_id)')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template pengiriman tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa template milik user yang terautentikasi
    if (template.store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke template pengiriman ini' },
        { status: 403 }
      );
    }

    // Hapus informasi store.user_id dari respons
    delete template.store;

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error getting delivery template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail template pengiriman' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui template pengiriman berdasarkan ID
async function updateDeliveryTemplate(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID template dari URL
    const pathname = request.nextUrl.pathname;
    const templateId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { name, content } = body;

    // Validasi input
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Parameter name dan content diperlukan' },
        { status: 400 }
      );
    }

    // Ambil detail template untuk verifikasi akses
    const { data: template, error: templateError } = await supabase
      .from('delivery_templates')
      .select('store_id')
      .eq('id', templateId)
      .single();

    if (templateError) {
      if (templateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template pengiriman tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: templateError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa template milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', template.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke template pengiriman ini' },
        { status: 403 }
      );
    }

    // Perbarui template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('delivery_templates')
      .update({
        name,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating delivery template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui template pengiriman' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus template pengiriman berdasarkan ID
async function deleteDeliveryTemplate(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID template dari URL
    const pathname = request.nextUrl.pathname;
    const templateId = pathname.split('/').pop() || '';

    // Ambil detail template untuk verifikasi akses
    const { data: template, error: templateError } = await supabase
      .from('delivery_templates')
      .select('store_id')
      .eq('id', templateId)
      .single();

    if (templateError) {
      if (templateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template pengiriman tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: templateError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa template milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', template.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke template pengiriman ini' },
        { status: 403 }
      );
    }

    // Cek apakah template digunakan oleh product_delivery_config
    const { data: configs, error: configError } = await supabase
      .from('product_delivery_config')
      .select('id')
      .eq('template_id', templateId);

    if (configError) {
      return NextResponse.json(
        { error: configError.message },
        { status: 500 }
      );
    }

    if (configs && configs.length > 0) {
      return NextResponse.json(
        { error: 'Template pengiriman sedang digunakan oleh konfigurasi pengiriman produk' },
        { status: 400 }
      );
    }

    // Hapus template
    const { error: deleteError } = await supabase
      .from('delivery_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Template pengiriman berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting delivery template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus template pengiriman' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getDeliveryTemplate);
export const PUT = withAuth(updateDeliveryTemplate);
export const DELETE = withAuth(deleteDeliveryTemplate);
