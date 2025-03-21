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
      
      vectors.push({
        id: doc.id,
        values: embedding,
        metadata: {
          storeId: doc.storeId,
          question: doc.question,
          answer: doc.answer,
          category: doc.category,
          tags: doc.tags,
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
      
      console.log(`Berhasil menyimpan ${vectors.length} FAQ Document ke Pinecone untuk toko ${storeId}`);
    } else {
      console.log(`Tidak ada FAQ Document untuk disimpan ke Pinecone untuk toko ${storeId}`);
    }
  } catch (error) {
    console.error("Error menyimpan FAQ Document ke Pinecone:", error);
    throw error;
  }
};

/**
 * Mencari FAQ Document di Pinecone berdasarkan query
 * @param storeId ID toko
 * @param question Pertanyaan untuk dicari
 * @param embeddings OpenAI Embeddings
 * @param topK Jumlah hasil teratas yang dikembalikan
 * @returns Array Document
 */
export const queryFAQsFromPinecone = async (
  storeId: string,
  question: string,
  embeddings: OpenAIEmbeddings,
  topK: number = 3
): Promise<Document[]> => {
  try {
    const index = getFAQIndex();
    
    // Buat embedding untuk query
    const queryEmbedding = await embeddings.embedQuery(question);
    
    // Query Pinecone
    const queryResult = await index.query({
      vector: queryEmbedding,
      topK,
      filter: {
        storeId: { $eq: storeId }
      },
      includeMetadata: true
    });
    
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
    
    return documents;
  } catch (error) {
    console.error("Error querying FAQ Document dari Pinecone:", error);
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
    console.log(`FAQ Document "${id}" berhasil dihapus dari Pinecone`);
  } catch (error) {
    console.error("Error menghapus FAQ Document dari Pinecone:", error);
    throw error;
  }
};
