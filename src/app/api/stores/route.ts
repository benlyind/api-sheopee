import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan semua toko milik user yang terautentikasi
async function getStores(request: AuthenticatedRequest) {
  try {
    // Pastikan user_id valid
    const userId = request.user.id;
    
    // Verifikasi bahwa user ada di tabel users
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userCheckError || !existingUser) {
      return NextResponse.json(
        { error: 'User tidak ditemukan di database' },
        { status: 404 }
      );
    }

    const { data: stores, error } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error getting stores:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data toko' },
      { status: 500 }
    );
  }
}

// POST: Membuat toko baru
async function createStore(request: AuthenticatedRequest) {
  try {
    // Pastikan user_id valid
    const userId = request.user.id;
    
    // Verifikasi bahwa user ada di tabel users
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userCheckError || !existingUser) {
      return NextResponse.json(
        { error: 'User tidak ditemukan di database' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { storeId, name, description, logoUrl } = body;

    // Validasi input
    if (!storeId || !name) {
      return NextResponse.json(
        { error: 'Parameter store_id dan name diperlukan' },
        { status: 400 }
      );
    }

    // Buat toko baru menggunakan storeId sebagai id
    const { data: store, error } = await supabase
      .from('stores')
      .insert([
        {
          id: storeId, // Gunakan storeId langsung sebagai id
          user_id: userId,
          name,
          description,
          logo_url: logoUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat toko' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getStores);
export const POST = withAuth(createStore);
