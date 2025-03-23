import { NextResponse } from 'next/server';
import { ApiResponse, ApiSuccess, ApiError } from '@/types/api';

/**
 * Fungsi untuk membuat respons API yang sukses
 * @param data Data yang akan dikembalikan
 * @param message Pesan sukses opsional
 * @param status Kode status HTTP (default: 200)
 * @param meta Metadata opsional (untuk pagination, dll)
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200,
  meta?: ApiResponse['meta']
): NextResponse {
  const response: ApiSuccess<T> = {
    success: true,
    data,
  };

  if (message) response.message = message;
  if (meta) response.meta = meta;

  return NextResponse.json(response, { status });
}

/**
 * Fungsi untuk membuat respons API yang gagal
 * @param error Pesan error
 * @param status Kode status HTTP (default: 400)
 * @param code Kode error opsional
 */
export function errorResponse(
  error: string,
  status: number = 400,
  code?: string
): NextResponse {
  const response: ApiError = {
    success: false,
    error,
  };

  if (code) response.code = code;

  return NextResponse.json(response, { status });
}
