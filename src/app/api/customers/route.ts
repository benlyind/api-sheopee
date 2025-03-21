import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan semua pelanggan berdasarkan store_id
async function getCustomers(request: AuthenticatedRequest) {
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

    // Ambil semua pelanggan untuk toko tertentu
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Error getting customers:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data pelanggan' },
      { status: 500 }
    );
  }
}

// POST: Membuat pelanggan baru
async function createCustomer(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { storeId, contactId, contactType, name } = body;

    // Validasi input
    if (!storeId || !contactId || !contactType) {
      return NextResponse.json(
        { error: 'Parameter store_id, contact_id, dan contact_type diperlukan' },
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

    // Generate UUID untuk id
    const customerId = crypto.randomUUID();

    // Buat pelanggan baru
    const { data: customer, error } = await supabase
      .from('customers')
      .insert([
        {
          id: customerId,
          store_id: storeId,
          contact_id: contactId,
          contact_type: contactType,
          name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      // Cek jika error karena unique constraint
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Pelanggan dengan contact_id dan contact_type ini sudah ada' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat pelanggan' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getCustomers);
export const POST = withAuth(createCustomer);
