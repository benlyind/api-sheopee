import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { supabase } from "@/lib/supabase";
import { storeFAQsInPinecone, queryFAQsFromPinecone, deleteFAQFromPinecone } from './pinecone';
import { generateFAQMetadata } from './faqUtils';

// Cache untuk menyimpan hasil pencarian FAQ
interface FAQCacheItem {
  documents: Document[];
  timestamp: number;
}
const faqCache = new Map<string, FAQCacheItem>();
const CACHE_TTL = 3600000; // 1 jam dalam milidetik

// Interface untuk FAQ Document
export interface FAQDocument {
  id: string;
  storeId: string;
  questionId?: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

// Interface untuk data question dari database
interface QuestionData {
  id: string;
  question: string;
  answer: string;
  category: string;
  tag: string[];
}

// Interface untuk data faq_documents dari database dengan relasi
interface FAQDocumentDbData {
  id: string;
  store_id: string;
  question_id: string;
  created_at: string;
  updated_at: string;
  question?: QuestionData;
}

// Fungsi untuk menyimpan FAQ Document
export const saveFAQDocument = async (faq: FAQDocument): Promise<void> => {
  try {
    // Generate tags dan kategori jika tidak disediakan
    let tags = faq.tags || [];
    let category = faq.category || '';
    
    if (!category || tags.length === 0) {
      const metadata = await generateFAQMetadata(faq.question, faq.answer);
      
      if (tags.length === 0) {
        tags = metadata.tags;
      }
      
      if (!category) {
        category = metadata.category;
      }
    }

    // Pertama, buat atau perbarui record di tabel question
    const questionId = faq.questionId || faq.id; // Use questionId if provided, otherwise use the faq.id
    const { data: questionData, error: questionError } = await supabase
      .from('question')
      .upsert([
        {
          id: questionId,
          question: faq.question,
          answer: faq.answer,
          category: category,
          tag: tags
        }
      ], { onConflict: 'id' })
      .select();

    if (questionError) {
      throw questionError;
    }
    
    // Pastikan questionData tidak kosong
    if (!questionData || questionData.length === 0) {
      throw new Error("Gagal menyimpan question: Tidak ada data yang dikembalikan");
    }

    // Kemudian, buat atau perbarui record di tabel faq_documents
    const { data, error } = await supabase
      .from('faq_documents')
      .upsert([
        {
          id: faq.id,
          store_id: faq.storeId,
          question_id: questionId,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'id' });

    if (error) {
      throw error;
    }
    
    await updateFAQVectorStore(faq.storeId);
  } catch (error) {
    console.error("Error saving FAQ Document:", error);
    throw error;
  }
};

// Fungsi untuk mendapatkan FAQ Document berdasarkan ID
export const getFAQDocument = async (storeId: string, id: string): Promise<FAQDocument | null> => {
  try {
    const { data, error } = await supabase
      .from('faq_documents')
      .select(`
        id,
        store_id,
        question_id,
        created_at,
        updated_at,
        question:question_id (
          id,
          question,
          answer,
          category,
          tag
        )
      `)
      .eq('store_id', storeId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    const faqData = data as unknown as FAQDocumentDbData;

    if (!faqData.question) {
      return null;
    }

    return {
      id: faqData.id,
      storeId: faqData.store_id,
      questionId: faqData.question_id,
      question: faqData.question.question,
      answer: faqData.question.answer,
      category: faqData.question.category,
      tags: Array.isArray(faqData.question.tag) ? faqData.question.tag : []
    };
  } catch (error) {
    console.error("Error getting FAQ Document:", error);
    return null;
  }
};

// Fungsi untuk mendapatkan semua FAQ Document
export const getAllFAQDocuments = async (storeId: string): Promise<FAQDocument[]> => {
  try {
    const { data, error } = await supabase
      .from('faq_documents')
      .select(`
        id,
        store_id,
        question_id,
        created_at,
        updated_at,
        question:question_id (
          id,
          question,
          answer,
          category,
          tag
        )
      `)
      .eq('store_id', storeId);

    if (error) {
      throw error;
    }

    // Cast data to our interface for type safety
    const faqsData = data as unknown as FAQDocumentDbData[];

    return faqsData.map(item => ({
      id: item.id,
      storeId: item.store_id,
      questionId: item.question_id,
      question: item.question?.question || '',
      answer: item.question?.answer || '',
      category: item.question?.category || '',
      tags: Array.isArray(item.question?.tag) ? item.question.tag : []
    }));
  } catch (error) {
    console.error("Error getting all FAQ Documents:", error);
    return [];
  }
};

// Fungsi untuk menghapus FAQ Document
export const deleteFAQDocument = async (storeId: string, id: string): Promise<void> => {
  try {
    // Dapatkan question_id dari dokumen FAQ terlebih dahulu
    const { data, error: getError } = await supabase
      .from('faq_documents')
      .select('question_id')
      .eq('store_id', storeId)
      .eq('id', id)
      .single();

    if (getError) {
      throw getError;
    }

    const questionId = data.question_id;

    // Hapus dokumen FAQ
    const { error } = await supabase
      .from('faq_documents')
      .delete()
      .eq('store_id', storeId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Cek apakah question_id masih digunakan di faq_documents lain
    const { data: otherDocs, error: checkError } = await supabase
      .from('faq_documents')
      .select('id')
      .eq('question_id', questionId);

    if (checkError) {
      throw checkError;
    }

    // Jika tidak ada lagi dokumen yang menggunakan question_id ini, hapus question
    if (otherDocs.length === 0) {
      const { error: deleteQuestionError } = await supabase
        .from('question')
        .delete()
        .eq('id', questionId);

      if (deleteQuestionError) {
        console.error("Error deleting question:", deleteQuestionError);
      }
    }
    
    // Hapus dari Pinecone
    try {
      await deleteFAQFromPinecone(storeId, id);
    } catch (error) {
      console.error("Error deleting FAQ Document dari Pinecone:", error);
    }
    
    // Update vector store untuk memastikan konsistensi
    await updateFAQVectorStore(storeId);
  } catch (error) {
    console.error("Error deleting FAQ Document:", error);
    throw error;
  }
};

// Fungsi untuk memperbarui vector store FAQ
export const updateFAQVectorStore = async (storeId: string): Promise<void> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return;
    }
    
    const faqs = await getAllFAQDocuments(storeId);
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey });
    
    // Simpan ke Pinecone
    try {
      await storeFAQsInPinecone(storeId, faqs, embeddings);
      
      // Hapus cache untuk storeId ini karena data telah berubah
      for (const key of faqCache.keys()) {
        if (key.startsWith(`${storeId}:`)) {
          faqCache.delete(key);
        }
      }
    } catch (error) {
      console.error("Error updating FAQ Vector Store di Pinecone:", error);
    }
  } catch (error) {
    console.error("Error in updateFAQVectorStore:", error);
  }
};

/**
 * Fungsi untuk query FAQ berdasarkan pertanyaan dengan caching
 * @param storeId ID toko
 * @param question Pertanyaan untuk dicari
 * @param k Jumlah hasil teratas yang dikembalikan
 * @returns Array Document
 */
export const queryFAQWithCache = async (storeId: string, question: string, k: number = 3): Promise<Document[]> => {
  const cacheKey = `${storeId}:${question}:${k}`;
  console.log(`[DEBUG FAQ] queryFAQWithCache - storeId: ${storeId}, question: "${question}", k: ${k}`);
  
  // Cek cache
  const cachedResult = faqCache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_TTL)) {
    console.log(`[DEBUG FAQ] Menggunakan hasil dari cache untuk key: ${cacheKey}`);
    console.log(`[DEBUG FAQ] Jumlah dokumen dalam cache: ${cachedResult.documents.length}`);
    return cachedResult.documents;
  }
  
  console.log(`[DEBUG FAQ] Cache miss atau expired untuk key: ${cacheKey}, melakukan pencarian baru`);
  
  // Jika tidak ada di cache, lakukan pencarian
  const documents = await queryFAQ(storeId, question, k);
  console.log(`[DEBUG FAQ] Hasil pencarian baru: ${documents.length} dokumen ditemukan`);
  
  // Simpan hasil ke cache
  if (documents.length > 0) {
    console.log(`[DEBUG FAQ] Menyimpan ${documents.length} dokumen ke cache dengan key: ${cacheKey}`);
    faqCache.set(cacheKey, {
      documents,
      timestamp: Date.now()
    });
  } else {
    console.log(`[DEBUG FAQ] Tidak ada dokumen untuk disimpan ke cache`);
  }
  
  return documents;
};

/**
 * Fungsi untuk query FAQ berdasarkan pertanyaan (hanya menggunakan Pinecone)
 * @param storeId ID toko
 * @param question Pertanyaan untuk dicari
 * @param k Jumlah hasil teratas yang dikembalikan
 * @returns Array Document
 */
export const queryFAQ = async (storeId: string, question: string, k: number = 3): Promise<Document[]> => {
  console.log(`[DEBUG FAQ] queryFAQ - storeId: ${storeId}, question: "${question}", k: ${k}`);
  
  try {
    // Cek apakah AI diaktifkan untuk toko ini
    try {
      console.log(`[DEBUG FAQ] Memeriksa status AI untuk toko ${storeId}`);
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('ai_enabled')
        .eq('id', storeId)
        .single();
      
      if (storeError) {
        console.warn(`[DEBUG FAQ] Tidak dapat menemukan toko dengan ID ${storeId}`);
        console.warn(`[DEBUG FAQ] Error: ${storeError.message}`);
        return [];
      } else if (!store.ai_enabled) {
        console.log(`[DEBUG FAQ] AI tidak diaktifkan untuk toko ${storeId}`);
        return [];
      }
      
      console.log(`[DEBUG FAQ] AI diaktifkan untuk toko ${storeId}, melanjutkan pencarian`);
    } catch (error) {
      console.error(`[DEBUG FAQ] Error saat memeriksa status AI untuk toko ${storeId}:`, error);
      console.error(`[DEBUG FAQ] Detail error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("[DEBUG FAQ] OpenAI API key tidak ditemukan");
      return [];
    }
    
    console.log(`[DEBUG FAQ] Membuat instance OpenAIEmbeddings`);
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey });
    
    // Gunakan hanya Pinecone untuk pencarian
    try {
      console.log(`[DEBUG FAQ] Memanggil queryFAQsFromPinecone untuk storeId: ${storeId}`);
      const documents = await queryFAQsFromPinecone(storeId, question, embeddings, k);
      console.log(`[DEBUG FAQ] Hasil dari Pinecone: ${documents.length} dokumen ditemukan`);
      
      if (documents.length > 0) {
        console.log(`[DEBUG FAQ] Dokumen pertama: ${documents[0].pageContent.substring(0, 100)}...`);
        console.log(`[DEBUG FAQ] Metadata dokumen pertama:`, documents[0].metadata);
      }
      
      return documents;
    } catch (error) {
      console.error("[DEBUG FAQ] Error querying FAQ dari Pinecone:", error);
      console.error(`[DEBUG FAQ] Detail error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`[DEBUG FAQ] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      return [];
    }
  } catch (error) {
    console.error("[DEBUG FAQ] Error in queryFAQ:", error);
    console.error(`[DEBUG FAQ] Detail error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`[DEBUG FAQ] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    return [];
  }
};
