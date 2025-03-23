import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FAQDocument } from './faq';

// Inisialisasi Pinecone client
let pineconeClient: Pinecone | null = null;

/**
 * Mendapatkan instance Pinecone client
 * @returns Instance Pinecone client
 */
export const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY tidak ditemukan di environment variables");
    }
    
    pineconeClient = new Pinecone({
      apiKey,
    });
  }
  
  return pineconeClient;
};

/**
 * Mendapatkan index Pinecone untuk FAQ
 * @returns Pinecone index
 */
export const getFAQIndex = () => {
  const indexName = process.env.PINECONE_INDEX_NAME || 'faq-embeddings';
  const pinecone = getPineconeClient();
  return pinecone.index(indexName);
};

/**
 * Menyimpan FAQ Document ke Pinecone
 * @param storeId ID toko
 * @param faqDocuments Array FAQ Document
 * @param embeddings OpenAI Embeddings
 */
export const storeFAQsInPinecone = async (
  storeId: string,
  faqDocuments: FAQDocument[],
  embeddings: OpenAIEmbeddings
): Promise<void> => {
  try {
    const index = getFAQIndex();
    // Untuk Pinecone Serverless dan Starter plan, kita tidak bisa menghapus dengan filter metadata
    // Jadi kita akan langsung melakukan upsert tanpa menghapus dokumen lama
    console.log(`Melewati penghapusan dokumen lama untuk toko ${storeId} karena keterbatasan Pinecone plan`);
    
    // Catatan: Jika Anda menggunakan Pinecone Standard plan atau yang lebih tinggi,
    // Anda bisa mengaktifkan kode di bawah ini untuk menghapus dokumen lama terlebih dahulu
    
    /*
    try {
      // Kode ini hanya berfungsi pada Pinecone Standard plan atau yang lebih tinggi
      await index.deleteMany({
        filter: {
          storeId: { $eq: storeId }
        }
      });
      console.log(`Berhasil menghapus dokumen FAQ lama untuk toko ${storeId} dari Pinecone`);
    } catch (error) {
      console.warn("Error saat menghapus dokumen lama dari Pinecone:", error);
      // Lanjutkan meskipun ada error
    }
    */
    
    // Persiapkan dokumen untuk upsert
    const vectors = [];
    
    for (const doc of faqDocuments) {
      const content = `${doc.question}\n${doc.answer}`;
      const embedding = await embeddings.embedQuery(content);
      
      // Pastikan tags adalah array string yang valid
      const validTags = Array.isArray(doc.tags) 
        ? doc.tags.filter((tag: string) => typeof tag === 'string' && tag.trim().length > 0).map((tag: string) => tag.trim())
        : [];
      
      vectors.push({
        id: doc.id,
        values: embedding,
        metadata: {
          storeId: doc.storeId,
          question: doc.question,
          answer: doc.answer,
          category: doc.category,
          tags: validTags,
          content
        }
      });
    }
    
    // Upsert dokumen ke Pinecone dalam batch
    if (vectors.length > 0) {
      const batchSize = 100; // Pinecone mendukung hingga 100 vektor per upsert
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
      }
    }
  } catch (error) {
    console.error("Error menyimpan FAQ Document ke Pinecone:", error);
    throw error;
  }
};

/**
 * Mencari FAQ Document di Pinecone berdasarkan query dengan timeout
 * @param storeId ID toko
 * @param question Pertanyaan untuk dicari
 * @param embeddings OpenAI Embeddings
 * @param topK Jumlah hasil teratas yang dikembalikan
 * @param timeoutMs Timeout dalam milidetik (default: 10000ms)
 * @returns Array Document
 */
export const queryFAQsFromPinecone = async (
  storeId: string,
  question: string,
  embeddings: OpenAIEmbeddings,
  topK: number = 3,
  timeoutMs: number = 10000 // Meningkatkan timeout dari 5000ms menjadi 10000ms
): Promise<Document[]> => {
  console.log(`[DEBUG PINECONE] queryFAQsFromPinecone - storeId: ${storeId}, question: "${question}", topK: ${topK}`);
  
  try {
    // Verifikasi konfigurasi Pinecone
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME || 'faq-embeddings';
    
    console.log(`[DEBUG PINECONE] Konfigurasi - API Key ada: ${!!apiKey}, Index Name: ${indexName}`);
    
    if (!apiKey) {
      console.error("[DEBUG PINECONE] PINECONE_API_KEY tidak ditemukan di environment variables");
      throw new Error("PINECONE_API_KEY tidak ditemukan di environment variables");
    }
    
    const index = getFAQIndex();
    console.log(`[DEBUG PINECONE] Index Pinecone berhasil didapatkan: ${indexName}`);
    
    // Buat embedding untuk query
    console.log(`[DEBUG PINECONE] Membuat embedding untuk query: "${question}"`);
    const startEmbedTime = Date.now();
    const queryEmbedding = await embeddings.embedQuery(question);
    const embedTime = Date.now() - startEmbedTime;
    console.log(`[DEBUG PINECONE] Embedding berhasil dibuat dalam ${embedTime}ms, dimensi: ${queryEmbedding.length}`);
    
    // Siapkan parameter query
    const queryParams = {
      vector: queryEmbedding,
      topK,
      filter: {
        storeId: { $eq: storeId }
      },
      includeMetadata: true
    };
    
    console.log(`[DEBUG PINECONE] Parameter query:`, JSON.stringify({
      topK: queryParams.topK,
      filter: queryParams.filter,
      includeMetadata: queryParams.includeMetadata,
      vectorLength: queryParams.vector.length
    }));
    
    // Query Pinecone dengan timeout
    console.log(`[DEBUG PINECONE] Mengirim query ke Pinecone dengan timeout ${timeoutMs}ms`);
    const startQueryTime = Date.now();
    
    const queryResult = await Promise.race([
      index.query(queryParams),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Pinecone query timeout')), timeoutMs)
      )
    ]);
    
    const queryTime = Date.now() - startQueryTime;
    console.log(`[DEBUG PINECONE] Query Pinecone selesai dalam ${queryTime}ms`);
    console.log(`[DEBUG PINECONE] Jumlah matches: ${queryResult.matches.length}`);
    
    if (queryResult.matches.length > 0) {
      console.log(`[DEBUG PINECONE] Match pertama - ID: ${queryResult.matches[0].id}, Score: ${queryResult.matches[0].score}`);
      console.log(`[DEBUG PINECONE] Metadata match pertama:`, queryResult.matches[0].metadata);
    }
    
    // Konversi hasil ke Document
    const documents = queryResult.matches.map(match => {
      const metadata = match.metadata as any;
      return new Document({
        pageContent: metadata.content,
        metadata: {
          id: match.id,
          storeId: metadata.storeId,
          category: metadata.category,
          tags: metadata.tags,
          similarity: match.score
        }
      });
    });
    
    console.log(`[DEBUG PINECONE] Berhasil mengkonversi ${documents.length} matches ke Document`);
    
    return documents;
  } catch (error) {
    if (error instanceof Error && error.message === 'Pinecone query timeout') {
      console.error(`[DEBUG PINECONE] Pinecone query timeout setelah ${timeoutMs}ms`);
    } else {
      console.error("[DEBUG PINECONE] Error querying FAQ Document dari Pinecone:", error);
      console.error(`[DEBUG PINECONE] Detail error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`[DEBUG PINECONE] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    }
    throw error;
  }
};

/**
 * Menghapus FAQ Document dari Pinecone
 * @param storeId ID toko
 * @param id ID dokumen
 */
export const deleteFAQFromPinecone = async (
  storeId: string,
  id: string
): Promise<void> => {
  try {
    const index = getFAQIndex();
    await index.deleteOne(id);
  } catch (error) {
    console.error("Error menghapus FAQ Document dari Pinecone:", error);
    throw error;
  }
};
