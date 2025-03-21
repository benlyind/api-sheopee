import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// Contoh API route yang dilindungi dengan autentikasi
async function handler(request: AuthenticatedRequest) {
  // User sudah terautentikasi, kita bisa mengakses request.user
  const user = request.user;

  return NextResponse.json({
    message: 'API ini dilindungi dengan autentikasi',
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
  });
}

// Gunakan middleware withAuth untuk melindungi route ini
export const GET = withAuth(handler);
