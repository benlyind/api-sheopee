import { ChatOpenAI } from "@langchain/openai";

/**
 * Menghasilkan tag utama untuk FAQ menggunakan AI
 * @param question Pertanyaan FAQ
 * @param answer Jawaban FAQ
 * @returns Tag utama (single string)
 */
export const generateFAQTag = async (question: string, answer: string): Promise<string> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return "";
    }
    
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0.2
    });
    
    const prompt = `
    Berdasarkan pertanyaan dan jawaban FAQ berikut, hasilkan tag utama yang paling relevan. 
    Tag harus berupa kata kunci pendek yang menggambarkan topik utama dari FAQ.
    
    Panduan untuk tag:
    - Gunakan kata kunci yang spesifik dan relevan dengan konten FAQ
    - Gunakan kata benda tunggal jika memungkinkan (misalnya "pengiriman" bukan "pengiriman-pengiriman")
    - Gunakan kata kunci yang konsisten untuk topik yang sama (misalnya selalu gunakan "pembayaran" untuk hal terkait pembayaran)
    - Hindari kata kunci yang terlalu umum seperti "informasi" atau "bantuan"
    - Prioritaskan kata kunci yang mungkin akan dicari oleh pengguna
    
    Contoh tag yang baik:
    - Untuk pertanyaan tentang pengiriman: "pengiriman" atau "ekspedisi"
    - Untuk pertanyaan tentang pembayaran: "pembayaran" atau "transfer"
    - Untuk pertanyaan tentang produk: "garansi" atau "spesifikasi"
    
    Penting: Pastikan untuk konsisten dalam memberikan tag untuk pertanyaan yang serupa.
    
    Pertanyaan: "${question}"
    Jawaban: "${answer}"
    
    Kembalikan hanya satu tag utama tanpa penjelasan tambahan.
    Tag:
    `;
    
    const response = await llm.invoke(prompt);
    const tag = response.content.toString().trim().toLowerCase();
    
    return tag;
  } catch (error) {
    console.error("Error generating FAQ tag:", error);
    return "";
  }
};

/**
 * Menghasilkan tags untuk FAQ menggunakan AI
 * @deprecated Use generateFAQTag instead for the new schema
 * @param question Pertanyaan FAQ
 * @param answer Jawaban FAQ
 * @returns Array of tags
 */
export const generateFAQTags = async (question: string, answer: string): Promise<string[]> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return [];
    }
    
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0.2
    });
    
    const prompt = `
    Analisis pertanyaan dan jawaban FAQ berikut, lalu hasilkan 3-5 tag yang paling relevan.
    Tag harus berupa kata kunci pendek dalam Bahasa Indonesia yang menggambarkan topik-topik utama dari FAQ.
    
    PANDUAN UNTUK TAGS:
    1. Setiap tag harus:
       - Berupa kata benda tunggal
       - Menggunakan huruf kecil semua
       - Tidak mengandung spasi (gunakan "-" jika perlu)
       - Spesifik dan relevan dengan konten
       - Mudah dicari oleh pengguna
    
    2. Hindari:
       - Kata yang terlalu umum (misal: "informasi", "bantuan", "cara","minimal")
       - Kata kerja
       - Kata sifat
       - Duplikasi makna
    
    3. Urutan tags:
       - Tag pertama harus yang paling relevan/utama
       - Diikuti tag pendukung yang masih relevan
    
    KATA KUNCI:
    - PELACAKAN
    - PENGIRIMAN
    - PEMBAYARAN
    - PRODUK
    - AKUN
    - PENGEMBALIAN
    - DISKON
    - PROMO
    - GARANSI
    - KETERSEDIAAN
    - STOK
    
    CONTOH FORMAT OUTPUT:
    Untuk FAQ tentang cara melacak pesanan:
    pelacakan, pesanan, pengiriman, resi, ekspedisi
    
    Untuk FAQ tentang metode pembayaran:
    pembayaran, transfer, e-wallet, bank, kartu-kredit
    
    Untuk FAQ tentang pengembalian produk:
    refund, pengembalian, retur, garansi, produk
    
    PERTANYAAN:
    "${question}"
    
    JAWABAN:
    "${answer}"
    
    BERIKAN HANYA DAFTAR TAG YANG DIPISAHKAN KOMA (3-5 TAG), TANPA PENJELASAN ATAU TEKS TAMBAHAN:
    `;
    
    const response = await llm.invoke(prompt);
    const tagsText = response.content.toString().trim();
    
    // Bersihkan dan format tags
    const tags = tagsText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag !== 'tags' && !tag.includes(':'));
    
    // Batasi jumlah tag dan hilangkan duplikat
    const uniqueTags = [...new Set(tags)].slice(0, 5);
    
    // Validasi format tags
    const validTags = uniqueTags.filter(tag => {
      // Tag harus berupa string yang valid
      if (typeof tag !== 'string' || tag.length === 0) return false;
      
      // Tag tidak boleh mengandung karakter khusus kecuali "-"
      if (!/^[a-z0-9-]+$/.test(tag)) return false;
      
      return true;
    });
    
    return validTags;
  } catch (error) {
    console.error("Error generating FAQ tags:", error);
    return [];
  }
};

/**
 * Menghasilkan kategori untuk FAQ menggunakan AI
 * @param question Pertanyaan FAQ
 * @param answer Jawaban FAQ
 * @returns Kategori FAQ
 */
export const generateFAQCategory = async (question: string, answer: string): Promise<string> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return "general";
    }
    
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0.2
    });
    
    const prompt = `
    Berdasarkan pertanyaan dan jawaban FAQ berikut, tentukan kategori yang paling sesuai.
    Pilih salah satu kategori berikut: "product", "price", "shipping", "payment", "account", "general".
    
    Panduan kategori:
    - "product": Untuk pertanyaan tentang detail produk, spesifikasi, fitur, garansi, ketersediaan, stok, atau kualitas produk.
    - "price": Untuk pertanyaan tentang harga, diskon, promosi, pengembalian dana, atau hal-hal terkait biaya.
    - "shipping": Untuk pertanyaan tentang pengiriman, waktu pengiriman, biaya pengiriman, pelacakan pesanan, atau alamat pengiriman.
    - "payment": Untuk pertanyaan tentang metode pembayaran, proses pembayaran, konfirmasi pembayaran, atau masalah pembayaran.
    - "account": Untuk pertanyaan tentang akun pengguna, pendaftaran, login, profil, atau pengaturan akun.
    - "general": Untuk pertanyaan umum yang tidak termasuk dalam kategori di atas.
    
    Penting: Pastikan untuk konsisten dalam mengkategorikan pertanyaan yang serupa. Jika pertanyaan memiliki beberapa aspek, pilih kategori yang paling dominan.
    
    Pertanyaan: "${question}"
    Jawaban: "${answer}"
    
    Kembalikan hanya nama kategori, tanpa penjelasan tambahan.
    Kategori:
    `;
    
    const response = await llm.invoke(prompt);
    const category = response.content.toString().trim().toLowerCase();
    
    // Validasi kategori
    const validCategories = ["product", "price", "shipping", "payment", "account", "general"];
    if (validCategories.includes(category)) {
      return category;
    }
    
    return "general";
  } catch (error) {
    console.error("Error generating FAQ category:", error);
    return "general";
  }
};

/**
 * Menghasilkan tag dan kategori untuk FAQ menggunakan AI
 * @param question Pertanyaan FAQ
 * @param answer Jawaban FAQ
 * @returns Object berisi tag dan kategori
 */
export const generateFAQMetadata = async (question: string, answer: string): Promise<{ tags: string[], category: string, tag: string }> => {
  try {
    // Generate tags dan kategori secara paralel untuk kinerja yang lebih baik
    const [tags, category] = await Promise.all([
      generateFAQTags(question, answer),
      generateFAQCategory(question, answer)
    ]);
    
    // Return both single tag and multiple tags for compatibility
    // Single tag diambil dari tag pertama jika ada
    return { 
      tag: tags.length > 0 ? tags[0] : "", 
      tags: tags,
      category 
    };
  } catch (error) {
    console.error("Error generating FAQ metadata:", error);
    return { tag: "", tags: [], category: "general" };
  }
};
