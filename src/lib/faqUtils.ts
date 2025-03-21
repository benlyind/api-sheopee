import { ChatOpenAI } from "@langchain/openai";

/**
 * Menghasilkan tags untuk FAQ menggunakan AI
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
    Berdasarkan pertanyaan dan jawaban FAQ berikut, hasilkan 3-5 tag yang relevan. 
    Tag harus berupa kata kunci pendek yang menggambarkan topik utama dari FAQ.
    
    Panduan untuk tags:
    - Gunakan kata kunci yang spesifik dan relevan dengan konten FAQ
    - Gunakan kata benda tunggal jika memungkinkan (misalnya "pengiriman" bukan "pengiriman-pengiriman")
    - Gunakan kata kunci yang konsisten untuk topik yang sama (misalnya selalu gunakan "pembayaran" untuk hal terkait pembayaran)
    - Hindari kata kunci yang terlalu umum seperti "informasi" atau "bantuan"
    - Prioritaskan kata kunci yang mungkin akan dicari oleh pengguna
    
    Contoh tags yang baik:
    - Untuk pertanyaan tentang pengiriman: "pengiriman", "ongkir", "ekspedisi", "estimasi", "tracking"
    - Untuk pertanyaan tentang pembayaran: "pembayaran", "transfer", "e-wallet", "kartu kredit", "cicilan"
    - Untuk pertanyaan tentang produk: "garansi", "spesifikasi", "ketersediaan", "stok", "kualitas"
    
    Penting: Pastikan untuk konsisten dalam memberikan tag untuk pertanyaan yang serupa.
    
    Pertanyaan: "${question}"
    Jawaban: "${answer}"
    
    Kembalikan hanya daftar tag yang dipisahkan koma, tanpa penjelasan tambahan.
    Tags:
    `;
    
    const response = await llm.invoke(prompt);
    const tagsText = response.content.toString().trim();
    
    // Bersihkan dan format tags
    const tags = tagsText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    // Batasi jumlah tag
    return tags.slice(0, 5);
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
 * Menghasilkan tags dan kategori untuk FAQ menggunakan AI
 * @param question Pertanyaan FAQ
 * @param answer Jawaban FAQ
 * @returns Object berisi tags dan kategori
 */
export const generateFAQMetadata = async (question: string, answer: string): Promise<{ tags: string[], category: string }> => {
  try {
    // Generate tags dan kategori secara paralel untuk kinerja yang lebih baik
    const [tags, category] = await Promise.all([
      generateFAQTags(question, answer),
      generateFAQCategory(question, answer)
    ]);
    
    return { tags, category };
  } catch (error) {
    console.error("Error generating FAQ metadata:", error);
    return { tags: [], category: "general" };
  }
};
