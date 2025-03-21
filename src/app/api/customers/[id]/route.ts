import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail pelanggan berdasarkan ID
async function getCustomer(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID pelanggan dari URL
    const pathname = request.nextUrl.pathname;
    const customerId = pathname.split('/').pop();

    // Ambil detail pelanggan
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Pelanggan tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Ambil informasi toko
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', customer.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    // Verifikasi bahwa pelanggan milik toko yang dimiliki oleh user yang terautentikasi
    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke pelanggan ini' },
        { status: 403 }
      );
    }

    // Hapus informasi stores dari respons
    delete customer.stores;

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error getting customer:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail pelanggan' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui pelanggan berdasarkan ID
async function updateCustomer(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID pelanggan dari URL
    const pathname = request.nextUrl.pathname;
    const customerId = pathname.split('/').pop();
    
    const body = await request.json();
    const { contactId, contactType, name } = body;

    // Validasi input
    if (!contactId || !contactType) {
      return NextResponse.json(
        { error: 'Parameter contact_id dan contact_type diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa pelanggan milik toko yang dimiliki oleh user yang terautentikasi
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('store_id')
      .eq('id', customerId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Pelanggan tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    // Ambil informasi toko
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', customer.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke pelanggan ini' },
        { status: 403 }
      );
    }

    // Perbarui pelanggan
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({
        contact_id: contactId,
        contact_type: contactType,
        name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single();

    if (updateError) {
      // Cek jika error karena unique constraint
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'Pelanggan dengan contact_id dan contact_type ini sudah ada' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui pelanggan' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus pelanggan berdasarkan ID
async function deleteCustomer(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID pelanggan dari URL
    const pathname = request.nextUrl.pathname;
    const customerId = pathname.split('/').pop();

    // Verifikasi bahwa pelanggan milik toko yang dimiliki oleh user yang terautentikasi
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('store_id')
      .eq('id', customerId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Pelanggan tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    // Ambil informasi toko
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', customer.store_id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: storeError.message },
        { status: 500 }
      );
    }

    if (store.user_id !== request.user.id) {
      return NextResponse.json(
        { error: 'Tidak memiliki akses ke pelanggan ini' },
        { status: 403 }
      );
    }

    // Hapus pelanggan
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Pelanggan berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus pelanggan' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getCustomer);
export const PUT = withAuth(updateCustomer);
export const DELETE = withAuth(deleteCustomer);
