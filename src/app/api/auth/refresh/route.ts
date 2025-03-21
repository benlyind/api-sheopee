import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, generateToken, formatAuthResponse, User } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token diperlukan' },
        { status: 400 }
      );
    }

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
      .select('id, email, full_name')
      .eq('email', payload.email)
      .single();

    // Buat user object
    const user: User = {
      id: payload.userId,
      email: payload.email,
      fullName: userData?.full_name || null,
    };

    // Generate token baru
    const newToken = generateToken(user);

    // Return response
    return NextResponse.json(formatAuthResponse(user, newToken));
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat refresh token' },
      { status: 500 }
    );
  }
}
