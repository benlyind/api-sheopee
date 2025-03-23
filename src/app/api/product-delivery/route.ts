import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { successResponse, errorResponse } from '@/lib/api/response';
import { validateStoreAccess, validateRequiredFields } from '@/lib/api/validation';
import { getData, getDataSingle, insertData, updateData } from '@/lib/api/database';
import { 
  GetProductDeliveryParams, 
  CreateProductDeliveryParams,
  GroupedDeliveryConfig,
  DeliveryConfigVariant,
  DeliveryTemplate
} from '@/types/api';

// Tipe untuk error yang dikembalikan oleh fungsi database
interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
}

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
    use_ai: boolean;
  }[] | { use_ai: boolean } | null;
}

// GET: Mengecek data product delivery berdasarkan store_id, product_id, dan variant_id (opsional)
async function checkProductDelivery(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    const productId = searchParams.get('product_id');
    const variantId = searchParams.get('variant_id');

    // Validasi input
    const validation = validateRequiredFields({ storeId }, ['storeId']);
    if (!validation.valid) {
      return errorResponse(validation.error!, 400);
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
        use_ai
      )
    `;

    // Buat filter berdasarkan parameter
    const filters: Record<string, any> = { store_id: storeId };
    if (productId) filters.product_id = productId;
    if (variantId) filters.variant_id = variantId;

    // Ambil data dari database
    let query = supabase
      .from('product_delivery_config')
      .select(selectQuery);

    // Tambahkan filter
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: deliveryConfig, error } = await query;

    console.log('Query Parameters:', { storeId, productId, variantId });
    console.log('Query Result:', deliveryConfig);

    if (error) {
      console.error('Query Error:', error);
      return errorResponse(error.message, 500);
    }

    // Jika tidak ada konfigurasi yang ditemukan, kembalikan array kosong
    if (!deliveryConfig || deliveryConfig.length === 0) {
      return successResponse([]);
    }

    interface GroupedData {
      [key: string]: GroupedDeliveryConfig;
    }

    // Kelompokkan data berdasarkan product_id
    const groupedData = (deliveryConfig as DeliveryConfigResult[]).reduce((acc: GroupedData, config) => {
      const productId = config.product_id;
      
      if (!acc[productId]) {
        // Inisialisasi data produk
        acc[productId] = {
      product_id: productId,
      store_id: config.store_id,
      type: config.type,
      use_ai: Array.isArray(config.product) ? config.product[0]?.use_ai || false : config.product?.use_ai || false,
      template: {
        name: Array.isArray(config.template) 
          ? (config.template.length > 0 ? config.template[0]?.name || "" : "") 
          : config.template?.name || "",
        content: Array.isArray(config.template) 
          ? (config.template.length > 0 ? config.template[0]?.content || "" : "") 
          : config.template?.content || ""
      },
          variants: []
        };
      }

      if (config.variant_id) {
        // Tambahkan ke array variants jika memiliki variant_id
        acc[productId].variants.push({
          variant_id: config.variant_id,
          status: config.status,
          account_data: config.account_data
        });
      } else {
        // Jika tidak memiliki variant_id, berarti ini adalah data produk
        acc[productId].status = config.status;
        acc[productId].account_data = config.account_data;
      }

      return acc;
    }, {});

    // Convert object ke array
    const formattedData = Object.values(groupedData);

    return successResponse(formattedData);
  } catch (error) {
    console.error('Error checking product delivery:', error);
    return errorResponse('Terjadi kesalahan saat mengecek data product delivery', 500);
  }
}

interface Variant {
  variantId: string;
  variantName: string;
  price: number;
  accountData: string; // accountData wajib untuk setiap varian
}

// POST: Membuat atau memperbarui konfigurasi pengiriman produk
async function createOrUpdateProductDelivery(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { 
      storeId, 
      productId, 
      productName,
      type,
      status,
      accountData,
      useAi,
      templateId,
      templateName,
      templateContent,
      variants 
    } = body;

    // Validasi input
    const requiredFields = ['storeId', 'type'];
    const validation = validateRequiredFields({ storeId, type }, requiredFields);
    if (!validation.valid) {
      return errorResponse(validation.error!, 400);
    }

    if (productId && !productName) {
      return errorResponse('Parameter productName diperlukan jika productId disediakan', 400);
    }

    // Validasi template
    let finalTemplateId = null;
    
    // Jika templateId disediakan, periksa apakah template tersebut ada
    if (templateId) {
      const { data: existingTemplate, error: templateCheckError } = await supabase
        .from('delivery_templates')
        .select('id')
        .eq('id', templateId)
        .eq('store_id', storeId)
        .single();

      if (templateCheckError && templateCheckError.code === 'PGRST116') {
        // Jika template tidak ditemukan atau invalid, kita akan membuat template baru
        if (!templateContent || !templateName) {
          return errorResponse(
            'Template tidak ditemukan. Jika ingin membuat template baru, sediakan templateContent dan templateName',
            400
          );
        }
      } else if (existingTemplate) {
        finalTemplateId = templateId;
      }
    }

    // Jika tidak ada templateId yang valid, pastikan templateContent dan templateName tersedia
    if (!finalTemplateId && (!templateContent || !templateName)) {
      return errorResponse(
        'Harus menyediakan templateContent dan templateName untuk membuat template baru',
        400
      );
    }

    // Validasi array variants jika ada
    if (variants && Array.isArray(variants)) {
      for (const variant of variants) {
        const variantValidation = validateRequiredFields(
          variant,
          ['variantId', 'variantName', 'price', 'accountData']
        );
        
        if (!variantValidation.valid) {
          return errorResponse(variantValidation.error!, 400);
        }
      }
    }

    // Verifikasi bahwa toko milik user yang terautentikasi
    const accessValidation = await validateStoreAccess(storeId, request.user.id);
    if (!accessValidation.valid) {
      return errorResponse(accessValidation.error!, accessValidation.status || 403);
    }

    // Jika productId disediakan, periksa dan tambahkan/update produk
    if (productId) {
      // Cek apakah produk sudah ada
      const { data: existingProduct, error: productCheckError } = await supabase
        .from('products')
        .select('product_id')
        .eq('product_id', productId)
        .eq('store_id', storeId)
        .single();

      if (productCheckError && productCheckError.code === 'PGRST116') {
        // Produk belum ada, tambahkan produk baru
        const productData = {
          product_id: productId,
          store_id: storeId,
          name: productName,
          use_ai: useAi !== undefined ? useAi : false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        const { error: insertProductError } = await supabase
          .from('products')
          .insert([productData]);

        if (insertProductError) {
          return errorResponse(`Gagal menambahkan produk: ${insertProductError.message}`, 500);
        }
      } else if (productCheckError) {
        return errorResponse(`Error saat memeriksa produk: ${productCheckError.message}`, 500);
      } else {
        // Update produk yang sudah ada
        const productData = {
          name: productName,
          use_ai: useAi !== undefined ? useAi : false,
          updated_at: new Date().toISOString()
        };
        
        const { error: updateProductError } = await supabase
          .from('products')
          .update(productData)
          .eq('product_id', productId)
          .eq('store_id', storeId);

        if (updateProductError) {
          return errorResponse(`Gagal memperbarui produk: ${updateProductError.message}`, 500);
        }
      }

      // Jika ada variants, periksa dan tambahkan setiap varian
      if (variants && Array.isArray(variants)) {
        for (const variant of variants) {
          const { variantId, variantName, price } = variant;

          // Cek apakah varian sudah ada
          const { data: existingVariant, error: variantCheckError } = await supabase
            .from('product_variants')
            .select('variant_id')
            .eq('variant_id', variantId)
            .eq('product_id', productId)
            .single();

          if (variantCheckError && variantCheckError.code === 'PGRST116') {
            // Varian belum ada, tambahkan varian baru
            const variantData = {
              variant_id: variantId,
              product_id: productId,
              name: variantName,
              price: price,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            const { error: insertVariantError } = await supabase
              .from('product_variants')
              .insert([variantData]);

            if (insertVariantError) {
              return errorResponse(`Gagal menambahkan varian: ${insertVariantError.message}`, 500);
            }
          } else if (variantCheckError) {
            return errorResponse(`Error saat memeriksa varian: ${variantCheckError.message}`, 500);
          }
        }
      }
    }

    // Buat template baru jika diperlukan
    if (!finalTemplateId && templateContent && templateName) {
      const newTemplateId = uuidv4();
      const { data: template, error: templateError } = await supabase
        .from('delivery_templates')
        .insert([
          {
            id: newTemplateId,
            store_id: storeId,
            name: templateName,
            content: templateContent,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (templateError) {
        return errorResponse(`Gagal membuat template: ${templateError.message}`, 500);
      }

      finalTemplateId = newTemplateId;
    }

    // Buat atau perbarui konfigurasi pengiriman untuk setiap varian
    const configs = [];
    
    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const variant of variants) {
        const { variantId, accountData: variantAccountData } = variant;
        
        // Cek apakah konfigurasi sudah ada untuk varian ini
        const { data: existingConfig, error: configError } = await supabase
          .from('product_delivery_config')
          .select('id')
          .eq('store_id', storeId)
          .eq('product_id', productId)
          .eq('variant_id', variantId)
          .maybeSingle();

        if (existingConfig) {
          // Update konfigurasi yang ada
          const { data: updatedConfig, error: updateError } = await supabase
            .from('product_delivery_config')
            .update({
              type,
              status: status || 'active',
              account_data: variantAccountData,
              template_id: finalTemplateId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingConfig.id)
            .select('*, template:delivery_templates!left(name, content)')
            .single();

          if (updateError) {
            return errorResponse(updateError.message, 500);
          }

          configs.push(updatedConfig);
        } else {
          // Buat konfigurasi baru
          const { data: newConfig, error: createError } = await supabase
            .from('product_delivery_config')
            .insert([
              {
                id: uuidv4(),
                store_id: storeId,
                product_id: productId,
                variant_id: variantId,
                type,
                status: status || 'active',
                account_data: variantAccountData,
                template_id: finalTemplateId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select('*, template:delivery_templates!left(name, content)')
            .single();

          if (createError) {
            return errorResponse(createError.message, 500);
          }

          configs.push(newConfig);
        }
      }

      return successResponse(configs, undefined, 201);
    } else {
      // Jika tidak ada variants, buat atau perbarui konfigurasi untuk produk saja
      const { data: existingConfig, error: configError } = await supabase
        .from('product_delivery_config')
        .select('id')
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .is('variant_id', null)
        .maybeSingle();

      if (existingConfig) {
        const { data: updatedConfig, error: updateError } = await supabase
          .from('product_delivery_config')
          .update({
            type,
            status: status || 'active',
            account_data: accountData,
            template_id: finalTemplateId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConfig.id)
          .select('*, template:delivery_templates!left(name, content)')
          .single();

        if (updateError) {
          return errorResponse(updateError.message, 500);
        }

        return successResponse(updatedConfig);
      } else {
        const { data: newConfig, error: createError } = await supabase
          .from('product_delivery_config')
          .insert([
            {
              id: uuidv4(),
              store_id: storeId,
              product_id: productId,
              variant_id: null,
              type,
              status: status || 'active',
              account_data: accountData,
              template_id: finalTemplateId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select('*, template:delivery_templates!left(name, content)')
          .single();

        if (createError) {
          return errorResponse(createError.message, 500);
        }

        return successResponse(newConfig, undefined, 201);
      }
    }
  } catch (error) {
    console.error('Error creating/updating product delivery:', error);
    return errorResponse('Terjadi kesalahan saat membuat/memperbarui konfigurasi pengiriman produk', 500);
  }
}

export const GET = withAuth(checkProductDelivery);
export const POST = withAuth(createOrUpdateProductDelivery);

// Tambahkan handler OPTIONS yang tidak dilindungi oleh withAuth
export async function OPTIONS() {
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
