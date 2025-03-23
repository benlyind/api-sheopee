import { supabase } from '@/lib/supabase';

/**
 * Fungsi untuk validasi akses toko
 * @param storeId ID toko
 * @param userId ID pengguna
 * @returns Object yang berisi status validasi dan pesan error jika ada
 */
export async function validateStoreAccess(
  storeId: string,
  userId: string
): Promise<{ valid: boolean; error?: string; status?: number }> {
  try {
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', storeId)
      .single();

    if (storeError) {
      if (storeError.code === 'PGRST116') {
        return { valid: false, error: 'Toko tidak ditemukan', status: 404 };
      }
      return { valid: false, error: storeError.message, status: 500 };
    }

    if (store.user_id !== userId) {
      return { valid: false, error: 'Tidak memiliki akses ke toko ini', status: 403 };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating store access:', error);
    return { valid: false, error: 'Terjadi kesalahan saat validasi akses toko', status: 500 };
  }
}

/**
 * Fungsi untuk validasi input dasar
 * @param input Object input yang akan divalidasi
 * @param requiredFields Array field yang wajib diisi
 * @returns Object yang berisi status validasi dan pesan error jika ada
 */
export function validateRequiredFields(
  input: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; error?: string } {
  const missingFields = requiredFields.filter(field => !input[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Parameter ${missingFields.join(', ')} diperlukan`
    };
  }
  
  return { valid: true };
}
