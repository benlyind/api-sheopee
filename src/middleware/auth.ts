import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, User } from '@/lib/auth';
import { handleCors } from '@/middleware';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

export async function authenticateRequest(
  request: NextRequest
): Promise<{ authenticated: boolean; request: AuthenticatedRequest; error?: string }> {
  // Ambil token dari header Authorization
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      request: request as AuthenticatedRequest,
      error: 'Token tidak ditemukan',
    };
  }

  const token = authHeader.split(' ')[1];

  // Validasi token
  const payload = verifyToken(token);
  if (!payload) {
    return {
      authenticated: false,
      request: request as AuthenticatedRequest,
      error: 'Token tidak valid atau kadaluarsa',
    };
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

  // Tambahkan user ke request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = user;

  return {
    authenticated: true,
    request: authenticatedRequest,
  };
}

export function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    // Skip authentication for OPTIONS requests
    const corsResponse = handleCors(request);
    if (corsResponse) {
      return corsResponse;
    }

    const { authenticated, request: authenticatedRequest, error } = await authenticateRequest(request);

    if (!authenticated) {
      return NextResponse.json({ error }, { status: 401 });
    }

    return handler(authenticatedRequest);
  };
}
