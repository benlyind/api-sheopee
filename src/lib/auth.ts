import { sign, verify } from 'jsonwebtoken';
import { supabase } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia-jwt-default-ganti-di-production';
const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

export interface User {
  id: string;
  email: string;
  fullName: string | null;
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
  };

  return sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', payload.userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
  };
}

export function formatAuthResponse(user: User, token: string): AuthResponse {
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
  };
}
