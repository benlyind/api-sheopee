import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function handleCors(request: NextRequest) {
  // Handling untuk preflight request OPTIONS
  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, {
      headers: {
        'Access-Control-Allow-Origin': 'https://app.bantudagang.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return null;
}

export function middleware(request: NextRequest) {
  // Handling untuk preflight request OPTIONS
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  return NextResponse.next();
}

// Gunakan middleware hanya untuk endpoint API
export const config = {
  matcher: '/api/:path*',
};
