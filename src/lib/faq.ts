import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import neo4j from "neo4j-driver";
import { supabase } from "@/lib/supabase";
import { storeFAQsInPinecone, queryFAQsFromPinecone, deleteFAQFromPinecone } from './pinecone';
import { generateFAQMetadata } from './faqUtils';

// Interface untuk FAQ Document
export interface FAQDocument {
  id: string;
  storeId: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

// Fungsi untuk menyimpan FAQ Document
export const saveFAQDocument = async (faq: FAQDocument): Promise<void> => {
  try {
    // Generate tags dan kategori jika tidak disediakan
    let tags = faq.tags || [];
    let category = faq.category || '';
    
    if (tags.length === 0 || !category) {
      console.log("Menghasilkan metadata otomatis untuk FAQ...");
      const metadata = await generateFAQMetadata(faq.question, faq.answer);
      
      if (tags.length === 0) {
        tags = metadata.tags;
        console.log(`Tags yang dihasilkan: ${tags.join(', ')}`);
      }
      
      if (!category) {
        category = metadata.category;
        console.log(`Kategori yang dihasilkan: ${category}`);
      }
    }
    
    const { data, error } = await supabase
      .from('faq_documents')
      .upsert([
        {
          id: faq.id,
          store_id: faq.storeId,
          question: faq.question,
          answer: faq.answer,
          category: category,
          tags: tags,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'id' });

    if (error) {
      throw error;
    }
    
    await updateFAQVectorStore(faq.storeId);
    console.log(`FAQ Document "${faq.id}" berhasil disimpan dengan ${tags.length} tags`);
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
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      id: data.id,
      storeId: data.store_id,
      question: data.question,
      answer: data.answer,
      category: data.category,
      tags: data.tags
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
      .select('*')
      .eq('store_id', storeId);

    if (error) {
      throw error;
    }

    return data.map(item => ({
      id: item.id,
      storeId: item.store_id,
      question: item.question,
      answer: item.answer,
      category: item.category,
      tags: item.tags
    }));
  } catch (error) {
    console.error("Error getting all FAQ Documents:", error);
    return [];
  }
};

// Fungsi untuk menghapus FAQ Document
export const deleteFAQDocument = async (storeId: string, id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('faq_documents')
      .delete()
      .eq('store_id', storeId)
      .eq('id', id);

    if (error) {
      throw error;
    }
    
    // Hapus dari Pinecone
    try {
      await deleteFAQFromPinecone(storeId, id);
      console.log(`FAQ Document "${id}" berhasil dihapus dari Pinecone`);
    } catch (error) {
      console.error("Error deleting FAQ Document dari Pinecone:", error);
    }
    
    // Update vector store untuk memastikan konsistensi
    await updateFAQVectorStore(storeId);
    console.log(`FAQ Document "${id}" berhasil dihapus`);
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
      console.log(`FAQ Vector Store untuk toko ${storeId} berhasil diperbarui di Pinecone`);
    } catch (error) {
      console.error("Error updating FAQ Vector Store di Pinecone:", error);
    }
    
    // Simpan juga ke Neo4j sebagai backup
    try {
      const driver = neo4j.driver(
        process.env.NEO4J_URI || "neo4j://localhost:7687",
        neo4j.auth.basic(
          process.env.NEO4J_USER || "neo4j",
          process.env.NEO4J_PASSWORD || "password"
        )
      );
      
      const session = driver.session();
      
      // Hapus semua FAQ Document yang ada di Neo4j untuk toko ini
      await session.run(
        `MATCH (f:FAQDocument {storeId: $storeId}) DETACH DELETE f`,
        { storeId }
      );
      
      // Simpan FAQ Document baru ke Neo4j
      for (const faq of faqs) {
        const content = `${faq.question}\n${faq.answer}`;
        const embedding = await embeddings.embedQuery(content);
        
        await session.run(
          `
          CREATE (f:FAQDocument {
            id: $id,
            storeId: $storeId,
            content: $content,
            category: $category,
            tags: $tags,
            embedding: $embedding
          })
          `,
          {
            id: faq.id,
            storeId: faq.storeId,
            content: content,
            category: faq.category,
            tags: faq.tags,
            embedding: embedding
          }
        );
      }
      
      await session.close();
      await driver.close();
      
      console.log(`FAQ Vector Store untuk toko ${storeId} berhasil diperbarui di Neo4j (backup)`);
    } catch (error) {
      console.error("Error updating FAQ Vector Store di Neo4j:", error);
    }
  } catch (error) {
    console.error("Error in updateFAQVectorStore:", error);
  }
};

// Fungsi untuk query FAQ berdasarkan pertanyaan
export const queryFAQ = async (storeId: string, question: string, k: number = 3): Promise<Document[]> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return [];
    }
    
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey });
    
    // Coba gunakan Pinecone untuk pencarian similarity
    try {
      console.log(`Mencari FAQ dengan Pinecone untuk pertanyaan: "${question}"`);
      const documents = await queryFAQsFromPinecone(storeId, question, embeddings, k);
      
      if (documents.length > 0) {
        console.log(`Ditemukan ${documents.length} FAQ Document dari Pinecone`);
        return documents;
      } else {
        console.log("Tidak ditemukan FAQ Document di Pinecone, mencoba Neo4j");
      }
    } catch (error) {
      console.error("Error querying FAQ dari Pinecone:", error);
      console.log("Falling back to Neo4j");
    }
    
    // Fallback ke Neo4j jika Pinecone gagal
    try {
      const questionEmbedding = await embeddings.embedQuery(question);
      const driver = neo4j.driver(
        process.env.NEO4J_URI || "neo4j://localhost:7687",
        neo4j.auth.basic(
          process.env.NEO4J_USER || "neo4j",
          process.env.NEO4J_PASSWORD || "password"
        )
      );
      
      const session = driver.session();
      
      // Coba gunakan query sederhana di Neo4j
      console.log("Menggunakan query sederhana di Neo4j");
      const result = await session.run(
        `
        MATCH (f:FAQDocument {storeId: $storeId})
        RETURN f.id AS id, f.content AS content, f.category AS category, f.tags AS tags, f.storeId AS storeId
        LIMIT toInteger($k)
        `,
        { storeId, k: parseInt(k.toString()) }
      );
    
      const documents = result.records.map(record => {
        return new Document({
          pageContent: record.get("content"),
          metadata: { 
            id: record.get("id"), 
            storeId: record.get("storeId"),
            category: record.get("category"), 
            tags: record.get("tags")
          }
        });
      });
      
      await session.close();
      await driver.close();
      
      if (documents.length > 0) {
        console.log(`Ditemukan ${documents.length} FAQ Document dari Neo4j`);
        return documents;
      } else {
        console.log("Tidak ditemukan FAQ Document di Neo4j, mencoba pencarian sederhana");
      }
    } catch (error) {
      console.error("Error querying FAQ Vector Store dari Neo4j:", error);
      console.log("Falling back to simple search");
    }
    
    // Fallback ke pencarian sederhana jika Neo4j tidak tersedia
    console.log("Menggunakan pencarian sederhana");
    const faqs = await getAllFAQDocuments(storeId);
    const documents = faqs.map(faq => new Document({
      pageContent: `${faq.question}\n${faq.answer}`,
      metadata: { 
        id: faq.id, 
        storeId: faq.storeId,
        category: faq.category, 
        tags: faq.tags.join(", ") 
      }
    }));
    
    // Filter dokumen berdasarkan kecocokan sederhana
    const filteredDocuments = documents.filter(doc => 
      doc.pageContent.toLowerCase().includes(question.toLowerCase())
    );
    
    console.log(`Ditemukan ${filteredDocuments.length} FAQ Document dari pencarian sederhana`);
    return filteredDocuments.slice(0, k);
  } catch (error) {
    console.error("Error in queryFAQ:", error);
    return [];
  }
};
