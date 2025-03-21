import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

// GET: Mengecek data product delivery berdasarkan store_id, product_id, dan variant_id (opsional)
async function checkProductDelivery(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    const productId = searchParams.get('product_id');
    const variantId = searchParams.get('variant_id');

    // Validasi input
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter store_id diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa toko milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', storeId)
      .single();

    if (storeError) {
      if (storeError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Toko tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Buat query untuk product_delivery_config
    let query = supabase
      .from('product_delivery_config')
      .select('*, template:delivery_templates(*)')
      .eq('store_id', storeId);

    // Jika productId diberikan, tambahkan filter
    if (productId) {
      query = query.eq('product_id', productId);
    }

    // Jika variantId diberikan, tambahkan filter
    if (variantId) {
      query = query.eq('variant_id', variantId);
    } else if (productId) {
      // Jika hanya productId yang diberikan, cari konfigurasi yang variant_id-nya null
      query = query.is('variant_id', null);
    }

    const { data: deliveryConfig, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Jika tidak ada konfigurasi yang ditemukan
    if (!deliveryConfig || deliveryConfig.length === 0) {
      return NextResponse.json(
        { message: 'Tidak ada konfigurasi pengiriman yang ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ deliveryConfig });
  } catch (error) {
    console.error('Error checking product delivery:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengecek data product delivery' },
      { status: 500 }
    );
  }
}

// POST: Membuat atau memperbarui konfigurasi pengiriman produk
async function createOrUpdateProductDelivery(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { storeId, productId, variantId, type, status, accountData, templateId, useAi, templateContent, templateName } = body;

    // Validasi input
    if (!storeId || !type) {
      return NextResponse.json(
        { error: 'Parameter store_id dan type diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa toko milik user yang terautentikasi
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', storeId)
      .single();

    if (storeError) {
      if (storeError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Toko tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke toko ini' },
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
            store_id: storeId,
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

    // Cek apakah konfigurasi sudah ada
    let query = supabase
      .from('product_delivery_config')
      .select('id')
      .eq('store_id', storeId);

    if (productId) {
      query = query.eq('product_id', productId);
    } else {
      query = query.is('product_id', null);
    }

    if (variantId) {
      query = query.eq('variant_id', variantId);
    } else {
      query = query.is('variant_id', null);
    }

    const { data: existingConfig, error: configError } = await query.maybeSingle();

    // Jika konfigurasi sudah ada, perbarui
    if (existingConfig) {
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
        .eq('id', existingConfig.id)
        .select('*, template:delivery_templates(*)')
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(updatedConfig);
    }

    // Jika konfigurasi belum ada, buat baru
    const { data: newConfig, error: createError } = await supabase
      .from('product_delivery_config')
      .insert([
        {
          id: uuidv4(),
          store_id: storeId,
          product_id: productId,
          variant_id: variantId,
          type,
          status: status || 'active',
          account_data: accountData,
          template_id: finalTemplateId,
          use_ai: useAi !== undefined ? useAi : false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('*, template:delivery_templates(*)')
      .single();

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(newConfig, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating product delivery:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat/memperbarui konfigurasi pengiriman produk' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(checkProductDelivery);
export const POST = withAuth(createOrUpdateProductDelivery);
