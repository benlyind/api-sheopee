/**
 * Tipe dasar untuk respons API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Tipe untuk respons error API
 */
export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Tipe untuk respons sukses API
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Tipe untuk data produk
 */
export interface Product {
  product_id: string;
  store_id: string;
  name: string;
  use_ai: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Tipe untuk data varian produk
 */
export interface ProductVariant {
  variant_id: string;
  product_id: string;
  name: string;
  price: number;
  created_at: string;
  updated_at: string;
}

/**
 * Tipe untuk data template pengiriman
 */
export interface DeliveryTemplate {
  name: string;
  content: string;
}

/**
 * Tipe untuk data konfigurasi pengiriman produk
 */
export interface ProductDeliveryConfig {
  id: string;
  store_id: string;
  product_id: string;
  variant_id?: string | null;
  type: string;
  status: string;
  account_data: string;
  template_id: string;
  created_at: string;
  updated_at: string;
  template?: DeliveryTemplate;
}

/**
 * Tipe untuk data varian dalam konfigurasi pengiriman
 */
export interface DeliveryConfigVariant {
  variant_id: string;
  status: string;
  account_data: string;
}

/**
 * Tipe untuk data konfigurasi pengiriman yang dikelompokkan
 */
export interface GroupedDeliveryConfig {
  product_id: string;
  store_id: string;
  type: string;
  template?: DeliveryTemplate;
  variants: DeliveryConfigVariant[];
  status?: string;
  account_data?: string;
  use_ai: boolean;
}

/**
 * Tipe untuk parameter permintaan GET product delivery
 */
export interface GetProductDeliveryParams {
  store_id: string;
  product_id?: string;
  variant_id?: string;
}

/**
 * Tipe untuk parameter permintaan POST product delivery
 */
export interface CreateProductDeliveryParams {
  storeId: string;
  productId?: string;
  productName?: string;
  type: string;
  status?: string;
  accountData?: string;
  useAi?: boolean;
  templateId?: string;
  templateName?: string;
  templateContent?: string;
  variants?: {
    variantId: string;
    variantName: string;
    price: number;
    accountData: string;
  }[];
}

/**
 * Tipe untuk parameter permintaan PUT product delivery
 */
export interface UpdateProductDeliveryParams {
  type: string;
  status?: string;
  accountData?: string;
  templateId?: string;
  useAi?: boolean;
  templateName?: string;
  templateContent?: string;
}
