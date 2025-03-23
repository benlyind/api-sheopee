import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fungsi untuk mendapatkan data dari tabel dengan filter
 * @param table Nama tabel
 * @param select String select (kolom yang akan diambil)
 * @param filters Object filter (key-value pairs)
 * @returns Data yang diambil dari database
 */
export async function getData(
  table: string,
  select: string = '*',
  filters: Record<string, any> = {}
) {
  try {
    let query = supabase.from(table).select(select);

    // Tambahkan filter
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error(`Error getting data from ${table}:`, error);
    return { data: null, error };
  }
}

/**
 * Fungsi untuk mendapatkan satu data dari tabel dengan filter
 * @param table Nama tabel
 * @param select String select (kolom yang akan diambil)
 * @param filters Object filter (key-value pairs)
 * @returns Data yang diambil dari database
 */
export async function getDataSingle(
  table: string,
  select: string = '*',
  filters: Record<string, any> = {}
) {
  try {
    let query = supabase.from(table).select(select);

    // Tambahkan filter
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: { message: `Data tidak ditemukan di tabel ${table}`, code: 'NOT_FOUND' } };
      }
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error(`Error getting single data from ${table}:`, error);
    return { data: null, error };
  }
}

/**
 * Fungsi untuk menyimpan data ke tabel
 * @param table Nama tabel
 * @param data Data yang akan disimpan
 * @param returnData Apakah mengembalikan data yang disimpan
 * @returns Data yang disimpan ke database
 */
export async function insertData(
  table: string,
  data: Record<string, any>,
  returnData: boolean = true
) {
  try {
    // Tambahkan created_at dan updated_at jika tidak ada
    if (!data.created_at) {
      data.created_at = new Date().toISOString();
    }
    if (!data.updated_at) {
      data.updated_at = new Date().toISOString();
    }
    
    // Tambahkan id jika tidak ada
    if (!data.id && table !== 'products' && table !== 'product_variants') {
      data.id = uuidv4();
    }

    const query = supabase.from(table).insert([data]);
    
    if (returnData) {
      const { data: insertedData, error } = await query.select().single();
      
      if (error) {
        throw error;
      }
      
      return { data: insertedData, error: null };
    } else {
      const { error } = await query;
      
      if (error) {
        throw error;
      }
      
      return { data, error: null };
    }
  } catch (error) {
    console.error(`Error inserting data to ${table}:`, error);
    return { data: null, error };
  }
}

/**
 * Fungsi untuk memperbarui data di tabel
 * @param table Nama tabel
 * @param data Data yang akan diperbarui
 * @param filters Object filter (key-value pairs)
 * @param returnData Apakah mengembalikan data yang diperbarui
 * @returns Data yang diperbarui di database
 */
export async function updateData(
  table: string,
  data: Record<string, any>,
  filters: Record<string, any>,
  returnData: boolean = true
) {
  try {
    // Tambahkan updated_at jika tidak ada
    if (!data.updated_at) {
      data.updated_at = new Date().toISOString();
    }

    let query = supabase.from(table).update(data);

    // Tambahkan filter
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, value);
      }
    });

    if (returnData) {
      const { data: updatedData, error } = await query.select().single();
      
      if (error) {
        throw error;
      }
      
      return { data: updatedData, error: null };
    } else {
      const { error } = await query;
      
      if (error) {
        throw error;
      }
      
      return { data, error: null };
    }
  } catch (error) {
    console.error(`Error updating data in ${table}:`, error);
    return { data: null, error };
  }
}

/**
 * Fungsi untuk menghapus data dari tabel
 * @param table Nama tabel
 * @param filters Object filter (key-value pairs)
 * @returns Status penghapusan
 */
export async function deleteData(
  table: string,
  filters: Record<string, any>
) {
  try {
    let query = supabase.from(table).delete();

    // Tambahkan filter
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, value);
      }
    });

    const { error } = await query;
    
    if (error) {
      throw error;
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error(`Error deleting data from ${table}:`, error);
    return { success: false, error };
  }
}
