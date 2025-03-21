-- Tabel untuk konfigurasi AI
CREATE TABLE IF NOT EXISTS "ai_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" VARCHAR(100) NOT NULL REFERENCES stores(id),
  "system_prompt" TEXT NOT NULL DEFAULT 'Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.',
  "custom_prompts" JSONB DEFAULT '{"default": "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.", "formal": "Anda adalah asisten penjual profesional yang memberikan informasi dengan bahasa formal dan sopan.", "casual": "Kamu adalah asisten penjual yang ramah dan menggunakan bahasa santai untuk membantu pelanggan."}',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk FAQ Document
CREATE TABLE IF NOT EXISTS "faq_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" VARCHAR(100) NOT NULL REFERENCES stores(id),
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL DEFAULT 'general',
  "tags" TEXT[] DEFAULT '{}',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk template respons
CREATE TABLE IF NOT EXISTS "response_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" VARCHAR(100) NOT NULL REFERENCES stores(id),
  "name" VARCHAR(100) NOT NULL,
  "content" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL DEFAULT 'general',
  "variables" TEXT[] DEFAULT '{}',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("store_id", "name")
);

-- Tabel untuk riwayat chat
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" VARCHAR(100) NOT NULL REFERENCES stores(id),
  "customer_id" UUID REFERENCES customers(id),
  "session_id" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) NOT NULL CHECK (role IN ('human', 'assistant')),
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indeks untuk mempercepat pencarian
CREATE INDEX IF NOT EXISTS "idx_ai_config_store_id" ON "ai_config" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_faq_documents_store_id" ON "faq_documents" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_faq_documents_category" ON "faq_documents" ("category");
CREATE INDEX IF NOT EXISTS "idx_faq_documents_tags" ON "faq_documents" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "idx_response_templates_store_id" ON "response_templates" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_response_templates_category" ON "response_templates" ("category");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_store_id" ON "chat_messages" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_customer_id" ON "chat_messages" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_session_id" ON "chat_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_created_at" ON "chat_messages" ("created_at");

-- Tambahkan kolom ai_enabled ke tabel stores
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "ai_enabled" BOOLEAN DEFAULT FALSE;

-- Tambahkan kolom ai_config_id ke tabel ai_trigger_config
ALTER TABLE "ai_trigger_config" ADD COLUMN IF NOT EXISTS "ai_config_id" UUID REFERENCES ai_config(id);

-- Tambahkan kolom ai_response ke tabel messages
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_response" BOOLEAN DEFAULT FALSE;
