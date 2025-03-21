-- ========= TABEL USERS =========
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- ========= TABEL STORES =========
CREATE TABLE stores (
    id VARCHAR(100) PRIMARY KEY, -- ID toko dari Shopee
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL SUBSCRIPTION_PLANS =========
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price_monthly DECIMAL(12, 2) NOT NULL,
    price_yearly DECIMAL(12, 2) NOT NULL,
    features JSONB NOT NULL, -- {"store_limit": 5, "product_limit": 100}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL SUBSCRIPTIONS =========
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    billing_cycle VARCHAR(50) NOT NULL, -- 'monthly' atau 'yearly'
    status VARCHAR(50) NOT NULL, -- 'active', 'expired', 'canceled'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL DELIVERY_TEMPLATES =========
-- PENTING: Dibuat lebih awal karena direferensikan oleh tabel lain
CREATE TABLE delivery_templates (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Template pesan dengan placeholder
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL PRODUCTS =========
CREATE TABLE products (
    id VARCHAR(100) PRIMARY KEY, -- ID Produk dari Shopee
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, id)
);

-- ========= TABEL PRODUCT_VARIANTS =========
CREATE TABLE product_variants (
    variant_id VARCHAR(100) PRIMARY KEY, -- ID Varian dari Shopee
    product_id VARCHAR(100) NOT NULL REFERENCES products(id),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, variant_id)
);

-- ========= TABEL PRODUCT_DELIVERY_CONFIG =========
-- Menggantikan kolom di Google Sheet: PRODUK-ID,VARIAN-ID,TYPE,STATUS,DATA-AKUN,TEMPLATE,USE-AI
CREATE TABLE product_delivery_config (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    product_id VARCHAR(100), -- ID Produk dari Shopee
    variant_id VARCHAR(100), -- ID Varian dari Shopee
    type VARCHAR(50) NOT NULL, -- Tipe produk (digital, fisik, layanan, dsb)
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- Status konfigurasi (active, inactive)
    account_data TEXT, -- Data akun untuk dikirimkan (login, password, dll)
    template_id UUID REFERENCES delivery_templates(id), -- Template yang digunakan
    use_ai BOOLEAN DEFAULT FALSE, -- Flag apakah akan menggunakan AI (tidak menyimpan respons)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_product_or_variant CHECK (
        (product_id IS NOT NULL) OR (variant_id IS NOT NULL)
    )
);

-- ========= TABEL AI_TRIGGER_CONFIG =========
-- Konfigurasi kata kunci untuk memicu API AI, tanpa menyimpan respons
CREATE TABLE ai_trigger_config (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL, -- Kata kunci untuk memicu respons AI
    is_active BOOLEAN DEFAULT TRUE,
    api_config JSONB, -- Konfigurasi API jika perlu penyesuaian per toko
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL CUSTOMERS =========
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    contact_id VARCHAR(255) NOT NULL, -- ID kontak (nomor WA, username Telegram, dll)
    contact_type VARCHAR(50) NOT NULL, -- 'whatsapp', 'telegram', dll
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, contact_id, contact_type)
);

-- ========= TABEL ORDERS =========
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_reference VARCHAR(255), -- Referensi pesanan eksternal
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL ORDER_ITEMS =========
CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id VARCHAR(100) NOT NULL, -- ID Produk dari Shopee
    variant_id VARCHAR(100), -- ID Varian dari Shopee
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL AUTO_DELIVERIES =========
CREATE TABLE auto_deliveries (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    product_id VARCHAR(100) NOT NULL,
    variant_id VARCHAR(100),
    delivery_message TEXT NOT NULL, -- Pesan yang dikirim (setelah template diproses)
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL MESSAGES =========
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    direction VARCHAR(10) NOT NULL, -- 'incoming' atau 'outgoing'
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'regular', -- 'regular', 'ai', 'delivery'
    delivery_id UUID REFERENCES auto_deliveries(id), -- Jika pesan ini adalah pengiriman produk
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========= TABEL CHANNEL_INTEGRATION =========
CREATE TABLE channel_integration (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    channel_type VARCHAR(50) NOT NULL, -- 'whatsapp', 'telegram', dll
    credentials JSONB NOT NULL, -- Token, API key, dll
    webhook_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, channel_type)
);

-- ========= TABEL API_KEYS =========
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    key_name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB, -- {"ai": true, "delivery": true}
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ========= TABEL SYSTEM_LOGS =========
CREATE TABLE system_logs (
    id UUID PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES stores(id),
    log_type VARCHAR(50) NOT NULL,
    description TEXT,
    reference_id UUID, -- ID dari record terkait (jika ada)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
