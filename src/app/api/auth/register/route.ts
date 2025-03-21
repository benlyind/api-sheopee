import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateToken, formatAuthResponse, User } from '@/lib/auth';
import { hash } from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    // Validasi input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    // Daftarkan user baru dengan Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Gagal mendaftarkan pengguna' },
        { status: 500 }
      );
    }

    // Hash password untuk disimpan di tabel users
    const passwordHash = await hash(password, 10);

    // Tambahkan data tambahan ke tabel users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: email,
          password_hash: passwordHash,
          full_name: fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (userError) {
      // Rollback: hapus user dari auth jika gagal menambahkan data tambahan
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      );
    }

    // Buat user object untuk token
    const user: User = {
      id: authData.user.id,
      email: email,
      fullName: fullName,
    };

    // Generate token
    const token = generateToken(user);

    // Return response
    return NextResponse.json(formatAuthResponse(user, token), { status: 201 });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendaftarkan pengguna' },
      { status: 500 }
    );
  }
}
