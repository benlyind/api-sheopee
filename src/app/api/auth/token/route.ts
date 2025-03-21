import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia-jwt-default-ganti-di-production';
const TOKEN_EXPIRY = '24h';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validasi input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    // Login dengan Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    // Cek apakah user sudah ada di tabel users
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    let userId = authData.user.id;
    let fullName = null;

    if (existingUser) {
      // User ditemukan di tabel users
      userId = existingUser.id;
      fullName = existingUser.full_name;

      // Update lastLogin
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } else {
      // User tidak ditemukan di tabel users, tambahkan
      // Hash password untuk disimpan di tabel users
      const passwordHash = await import('bcrypt').then(mod => mod.hash(password, 10));

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            password_hash: passwordHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: 'Gagal membuat data pengguna' },
          { status: 500 }
        );
      }

      userId = newUser.id;
    }

    // Buat payload untuk token JWT
    const payload = {
      userId: userId,
      email: authData.user.email,
    };

    // Generate token JWT
    const token = sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    // Return response
    return NextResponse.json({
      token,
      user: {
        id: userId,
        email: authData.user.email,
        fullName: fullName,
      },
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat generate token' },
      { status: 500 }
    );
  }
}
