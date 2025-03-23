import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api/response';
import { validateStoreAccess, validateRequiredFields } from '@/lib/api/validation';
import { DeliveryTemplate } from '@/types/api';

// Interface untuk data yang dikembalikan dari query Supabase
interface DeliveryConfigResult {
  id: string;
  store_id: string;
  product_id: string;
  variant_id: string | null;
  type: string;
  status: string;
  account_data: string;
  template_id: string;
  template: DeliveryTemplate[] | DeliveryTemplate | null;
  product: {
    name: string;
    use_ai: boolean;
  }[] | { name: string; use_ai: boolean } | null;
}

// GET: Mengambil produk dan menerapkan template
async function getProduct(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    const templateText = searchParams.get('template_text');
    const productId = searchParams.get('product_id');
    const variantId = searchParams.get('variant_id');
    const qtyParam = searchParams.get('qty');
    const orderItemId = searchParams.get('order_item_id');
    const customerId = searchParams.get('customer_id');
    
    // Parse qty, default ke 1 jika tidak disediakan atau tidak valid
    const qty = qtyParam ? parseInt(qtyParam, 10) : 1;

    // Validasi input
    const validation = validateRequiredFields({ storeId }, ['storeId']);
    if (!validation.valid) {
      return errorResponse(validation.error!, 400);
    }

    // Validasi orderItemId dan customerId
    if ((orderItemId && !customerId) || (!orderItemId && customerId)) {
      return errorResponse('Parameter order_item_id dan customer_id harus disediakan bersama-sama', 400);
    }

    // Verifikasi bahwa toko milik user yang terautentikasi
    const accessValidation = await validateStoreAccess(storeId!, request.user.id);
    if (!accessValidation.valid) {
      return errorResponse(accessValidation.error!, accessValidation.status || 403);
    }

    // Buat query untuk product_delivery_config dengan join ke products dan template
    const selectQuery = `
      id,
      store_id,
      product_id,
      variant_id,
      type,
      status,
      account_data,
      template_id,
      template:delivery_templates(
        id,
        name,
        content
      ),
      product:products(
        name,
        use_ai
      )
    `;

    // Buat query dasar
    let query = supabase
      .from('product_delivery_config')
      .select(selectQuery)
      .eq('store_id', storeId)
      .eq('status', 'active');
    
    // Tambahkan filter berdasarkan product_id jika ada
    if (productId) {
      query = query.eq('product_id', productId);
    }
    
    // Tambahkan filter berdasarkan variant_id jika ada
    if (variantId) {
      query = query.eq('variant_id', variantId);
    }
    
    // Ambil data dari database
    const { data: deliveryConfigs, error } = await query;

    if (error) {
      console.error('Query Error:', error);
      return errorResponse(error.message, 500);
    }

    // Jika tidak ada konfigurasi yang ditemukan, kembalikan sukses dengan pesan
    if (!deliveryConfigs || deliveryConfigs.length === 0) {
      return successResponse(null, 'pengiriman otomatis tidak diaktifkan untuk produk atau varian', 404);
    }

    // Pilih konfigurasi berdasarkan varian atau produk
    let selectedConfig: DeliveryConfigResult | null = null;
    
    // Jika variantId disediakan, cari konfigurasi dengan variant_id yang sesuai
    if (variantId) {
      console.log(`Mencari konfigurasi dengan variant_id: ${variantId}`);
      selectedConfig = deliveryConfigs.find(
        config => config.variant_id === variantId
      ) as DeliveryConfigResult;
      
      if (!selectedConfig) {
        return successResponse(null, 'pengiriman otomatis tidak diaktifkan untuk produk atau varian', 404);
      }
    } 
    // Jika productId disediakan tapi tidak variantId, cari konfigurasi produk tanpa varian
    else if (productId) {
      console.log(`Mencari konfigurasi dengan product_id: ${productId} tanpa variant_id`);
      selectedConfig = deliveryConfigs.find(
        config => config.product_id === productId && config.variant_id === null
      ) as DeliveryConfigResult;
      
      if (!selectedConfig) {
        // Jika tidak ada konfigurasi tanpa varian, ambil konfigurasi pertama dengan product_id yang sesuai
        selectedConfig = deliveryConfigs.find(
          config => config.product_id === productId
        ) as DeliveryConfigResult;
        
        if (!selectedConfig) {
          return successResponse(null, 'pengiriman otomatis tidak diaktifkan untuk produk atau varian', 404);
        }
      }
    }
    // Jika tidak ada productId atau variantId, ambil konfigurasi pertama
    else if (deliveryConfigs.length > 0) {
      console.log('Mengambil konfigurasi pertama');
      selectedConfig = deliveryConfigs[0] as DeliveryConfigResult;
    }
    
    // Jika tidak ada konfigurasi yang ditemukan, kembalikan sukses dengan pesan
    if (!selectedConfig) {
      return successResponse(null, 'pengiriman otomatis tidak diaktifkan untuk produk atau varian', 404);
    }
    
    // Ambil data produk dan template
    const productName = Array.isArray(selectedConfig.product) 
      ? selectedConfig.product[0]?.name || ''
      : selectedConfig.product?.name || '';
    
    // Ambil dan proses account_data berdasarkan qty
    let productData = '';
    const accountData = selectedConfig.account_data || '';
    
    // Periksa apakah account_data kosong
    if (!accountData || accountData.trim() === '' || accountData.trim() === ',') {
      return successResponse(null, 'Mohon maaf persediaan produk saat ini kosong', 404);
    }
    
    // Jika account_data berisi daftar yang dipisahkan koma
    if (accountData.includes(',')) {
      const items = accountData.split(',').filter(item => item.trim() !== '');
      
      // Jika tidak ada item yang valid
      if (items.length === 0) {
        return successResponse(null, 'Mohon maaf persediaan produk saat ini kosong', 404);
      }
      
      // Jika tipe adalah ACCOUNT atau VOUCHER
      if (selectedConfig.type === 'ACCOUNT' || selectedConfig.type === 'VOUCHER') {
        // Ambil sejumlah qty item dari daftar
        const itemsToTake = Math.min(qty, items.length);
        const selectedItems = items.slice(0, itemsToTake);
        productData = selectedItems.join(',');
        
        // Hapus item yang diambil dari daftar
        const remainingItems = items.slice(itemsToTake);
        const updatedAccountData = remainingItems.join(',');
        
        // Update account_data di database
        const { error: updateDataError } = await supabase
          .from('product_delivery_config')
          .update({ account_data: updatedAccountData })
          .eq('id', selectedConfig.id);
        
        if (updateDataError) {
          console.error('Update Data Error:', updateDataError);
          return errorResponse(`Gagal memperbarui data produk: ${updateDataError.message}`, 500);
        }
        
        // Jika setelah mengambil data, data menjadi kosong, update status menjadi 'used'
        if (remainingItems.length === 0) {
          const { error: updateStatusError } = await supabase
            .from('product_delivery_config')
            .update({ status: 'used' })
            .eq('id', selectedConfig.id);
          
          if (updateStatusError) {
            console.error('Update Status Error:', updateStatusError);
            // Tidak perlu mengembalikan error, karena produk sudah berhasil diambil
          }
        }
      } 
      // Jika tipe adalah LINK
      else if (selectedConfig.type === 'LINK') {
        // Ambil sejumlah qty item dari daftar tanpa menghapus
        const itemsToTake = Math.min(qty, items.length);
        const selectedItems = items.slice(0, itemsToTake);
        productData = selectedItems.join(',');
      }
    } 
    // Jika account_data tidak berisi daftar yang dipisahkan koma
    else {
      productData = accountData;
    }
    
    // Ambil template berdasarkan template_id yang sudah di-set di konfigurasi produk
    let templateContent = '';
    
    if (selectedConfig.template_id) {
      // Jika template_id ada, gunakan template yang sesuai
      const { data: template, error: templateError } = await supabase
        .from('delivery_templates')
        .select('content')
        .eq('id', selectedConfig.template_id)
        .single();
      
      if (templateError) {
        console.error('Template Error:', templateError);
        return errorResponse(`Gagal mengambil template: ${templateError.message}`, 500);
      }
      
      if (template) {
        templateContent = template.content;
      }
    } else {
      // Jika tidak ada template_id, gunakan template dari join query
      templateContent = Array.isArray(selectedConfig.template) 
        ? selectedConfig.template[0]?.content || ''
        : selectedConfig.template?.content || '';
    }
    
    // Jika template_text disediakan, gunakan itu sebagai template override
    if (templateText) {
      templateContent = templateText;
    }
    
    // Terapkan template dengan mengganti variabel
    let finalContent = templateContent;
    
    // Ganti variabel {{PRODUK}} dengan account_data
    finalContent = finalContent.replace(/{{PRODUK}}/g, productData);
    
    // Ganti variabel {{NAMAPRODUK}} dengan nama produk
    finalContent = finalContent.replace(/{{NAMAPRODUK}}/g, productName);
    
    // Validasi tipe produk
    if (selectedConfig.type !== 'ACCOUNT' && selectedConfig.type !== 'VOUCHER' && selectedConfig.type !== 'LINK') {
      return errorResponse('Tipe produk tidak valid', 400);
    }

    // Jika orderItemId dan customerId disediakan, buat entri baru di tabel auto_deliveries
    if (orderItemId && customerId) {
      try {
        const { data: autoDelivery, error: autoDeliveryError } = await supabase
          .from('auto_deliveries')
          .insert([
            {
              store_id: storeId,
              order_item_id: orderItemId,
              customer_id: customerId,
              product_id: selectedConfig.product_id,
              variant_id: selectedConfig.variant_id,
              delivery_message: finalContent,
              status: 'delivered',
              sent_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            }
          ])
          .select()
          .single();
        
        if (autoDeliveryError) {
          console.error('Auto Delivery Error:', autoDeliveryError);
          // Tidak perlu mengembalikan error, karena produk sudah berhasil diambil
        }
      } catch (autoDeliveryError) {
        console.error('Auto Delivery Error:', autoDeliveryError);
        // Tidak perlu mengembalikan error, karena produk sudah berhasil diambil
      }
    }

    // Kembalikan hasil
    return successResponse({
      product_id: selectedConfig.product_id,
      product_name: productName,
      product_data: productData,
      template_content: templateContent,
      final_content: finalContent,
      variant_id: selectedConfig.variant_id
    });
  } catch (error) {
    console.error('Error getting product:', error);
    return errorResponse('Terjadi kesalahan saat mengambil produk', 500);
  }
}

export const GET = withAuth(getProduct);

// Tambahkan handler OPTIONS yang tidak dilindungi oleh withAuth
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': 'https://app.bantudagang.com',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
