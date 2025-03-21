import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateToken, formatAuthResponse, User } from '@/lib/auth';

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

    // Buat user object untuk token
    const user: User = {
      id: userId,
      email: email,
      fullName: fullName,
    };

    // Generate token
    const token = generateToken(user);

    // Return response
    return NextResponse.json(formatAuthResponse(user, token));
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login' },
      { status: 500 }
    );
  }
}
