import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

// GET: Mendapatkan semua template pengiriman berdasarkan store_id
async function getDeliveryTemplates(request: AuthenticatedRequest) {
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

    // Ambil semua template untuk store tertentu
    const { data: templates, error } = await supabase
      .from('delivery_templates')
      .select('*')
      .eq('store_id', storeId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error getting delivery templates:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data template pengiriman' },
      { status: 500 }
    );
  }
}

// POST: Membuat template pengiriman baru
async function createDeliveryTemplate(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { storeId, name, content } = body;

    // Validasi input
    if (!storeId || !name || !content) {
      return NextResponse.json(
        { error: 'Parameter store_id, name, dan content diperlukan' },
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

    // Generate UUID untuk template
    const templateId = uuidv4();

    // Buat template baru
    const { data: template, error: templateError } = await supabase
      .from('delivery_templates')
      .insert([
        {
          id: templateId,
          store_id: storeId,
          name,
          content,
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

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat template pengiriman' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getDeliveryTemplates);
export const POST = withAuth(createDeliveryTemplate);
