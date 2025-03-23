import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Ambil token dari header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token tidak ditemukan' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Validasi token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token tidak valid atau kadaluarsa' },
        { status: 401 }
      );
    }

    // Coba ambil data user dari Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, stores(id, name)')
      .eq('email', payload.email)
      .single();

    // Return informasi user
    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        fullName: userData?.full_name || null,
        stores: userData?.stores || [],
      },
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memvalidasi token' },
      { status: 500 }
    );
  }
}
