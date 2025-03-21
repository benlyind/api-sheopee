import { ChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import neo4j, { Driver } from "neo4j-driver";
import { 
  AgentExecutor, 
  createOpenAIFunctionsAgent 
} from "langchain/agents";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder 
} from "@langchain/core/prompts";
import { 
  DynamicTool, 
  DynamicStructuredTool 
} from "@langchain/core/tools";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// Interface untuk konfigurasi AI
export interface AIConfig {
  systemPrompt: string;
  customPrompts: Record<string, string>;
}

import { 
  FAQDocument, 
  queryFAQ, 
  saveFAQDocument, 
  getFAQDocument, 
  getAllFAQDocuments, 
  deleteFAQDocument, 
  updateFAQVectorStore 
} from './faq';

// Fungsi untuk mendapatkan konfigurasi AI dari database
export const getAIConfig = async (storeId: string): Promise<AIConfig> => {
  try {
    const { data: config, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error) {
      console.warn(`Konfigurasi AI untuk toko ${storeId} tidak ditemukan, menggunakan default`);
      return {
        systemPrompt: "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
        customPrompts: {
          "default": "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
          "formal": "Anda adalah asisten penjual profesional yang memberikan informasi dengan bahasa formal dan sopan.",
          "casual": "Kamu adalah asisten penjual yang ramah dan menggunakan bahasa santai untuk membantu pelanggan."
        }
      };
    }

    return {
      systemPrompt: config.system_prompt,
      customPrompts: config.custom_prompts
    };
  } catch (error) {
    console.error("Error getting AI config:", error);
    return {
      systemPrompt: "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
      customPrompts: {
        "default": "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
        "formal": "Anda adalah asisten penjual profesional yang memberikan informasi dengan bahasa formal dan sopan.",
        "casual": "Kamu adalah asisten penjual yang ramah dan menggunakan bahasa santai untuk membantu pelanggan."
      }
    };
  }
};

// Kelas untuk menyimpan riwayat chat di Neo4j
class Neo4jChatMessageHistory extends BaseChatMessageHistory {
  private driver: Driver | null = null;
  private sessionId: string;
  private storeId: string;
  private messages: BaseMessage[] = [];
  lc_namespace: string[] = ["langchain", "chat_history", "neo4j"];
  
  get lc_id(): string[] {
    return ["neo4j", "chat_history", this.sessionId];
  }

  constructor(sessionId: string, storeId: string) {
    super();
    this.sessionId = sessionId;
    this.storeId = storeId;
    try {
      this.driver = neo4j.driver(
        process.env.NEO4J_URI || "neo4j://localhost:7687",
        neo4j.auth.basic(
          process.env.NEO4J_USER || "neo4j",
          process.env.NEO4J_PASSWORD || "password"
        )
      );
    } catch (error) {
      console.error("Gagal terhubung ke Neo4j:", error);
      this.driver = null;
    }
  }

  // Mengambil semua pesan dari Neo4j atau memori
  async getMessages(): Promise<BaseMessage[]> {
    if (!this.driver) {
      // Jika Neo4j tidak tersedia, coba ambil dari database
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', this.sessionId)
          .eq('store_id', this.storeId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error("Gagal mengambil pesan dari database:", error);
          return this.messages;
        }

        return data.map((message) => {
          return message.role === "human" 
            ? new HumanMessage(message.content) 
            : new AIMessage(message.content);
        });
      } catch (error) {
        console.error("Gagal mengambil pesan dari database:", error);
        return this.messages;
      }
    }
    
    try {
      const session = this.driver.session();
      const result = await session.run(
        `
        MATCH (c:Conversation {sessionId: $sessionId, storeId: $storeId})-[:HAS_MESSAGE]->(m:Message)
        RETURN m.type as type, m.content as content
        ORDER BY m.timestamp
      `,
        { sessionId: this.sessionId, storeId: this.storeId }
      );
      const messages = result.records.map((record) => {
        const type = record.get("type");
        const content = record.get("content");
        return type === "human" ? new HumanMessage(content) : new AIMessage(content);
      });
      await session.close();
      return messages;
    } catch (error) {
      console.error("Gagal mengambil pesan dari Neo4j:", error);
      return this.messages;
    }
  }

  // Menambahkan satu pesan ke Neo4j
  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
    
    // Simpan ke database
    try {
      const messageType = message instanceof HumanMessage ? "human" : "assistant";
      await supabase.from('chat_messages').insert([
        {
          store_id: this.storeId,
          session_id: this.sessionId,
          role: messageType,
          content: message.content,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error("Gagal menambahkan pesan ke database:", error);
    }
    
    if (!this.driver) {
      console.warn("Driver Neo4j tidak tersedia, pesan hanya disimpan di database.");
      return;
    }
    
    try {
      const session = this.driver.session();
      
      // Pastikan conversation node ada
      await session.run(
        `
        MERGE (c:Conversation {sessionId: $sessionId, storeId: $storeId})
        ON CREATE SET c.created_at = datetime()
        RETURN c
      `,
        { sessionId: this.sessionId, storeId: this.storeId }
      );
      
      const messageType = message instanceof HumanMessage ? "human" : "ai";
      await session.run(
        `
        MATCH (c:Conversation {sessionId: $sessionId, storeId: $storeId})
        CREATE (m:Message {type: $type, content: $content, timestamp: datetime()})
        CREATE (c)-[:HAS_MESSAGE]->(m)
      `,
        {
          sessionId: this.sessionId,
          storeId: this.storeId,
          type: messageType,
          content: message.content,
        }
      );
      await session.close();
    } catch (error) {
      console.error("Gagal menambahkan pesan ke Neo4j:", error);
    }
  }

  // Menambahkan pesan pengguna
  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  // Menambahkan pesan AI
  async addAIChatMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  // Menambahkan beberapa pesan sekaligus
  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  // Membersihkan riwayat pesan
  async clear(): Promise<void> {
    this.messages = [];
    
    // Hapus dari database
    try {
      await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', this.sessionId)
        .eq('store_id', this.storeId);
    } catch (error) {
      console.error("Gagal membersihkan pesan dari database:", error);
    }
    
    if (!this.driver) {
      return;
    }
    
    try {
      const session = this.driver.session();
      await session.run(
        `
        MATCH (c:Conversation {sessionId: $sessionId, storeId: $storeId})-[:HAS_MESSAGE]->(m:Message)
        DETACH DELETE m
      `,
        { sessionId: this.sessionId, storeId: this.storeId }
      );
      await session.close();
    } catch (error) {
      console.error("Gagal membersihkan pesan dari Neo4j:", error);
    }
  }

  // Metode untuk menutup koneksi Neo4j
  async close(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.close();
      } catch (error) {
        console.error("Error closing Neo4j connection:", error);
      }
    }
  }
}

// Fungsi untuk mendapatkan informasi produk
export const getProductInfo = async (storeId: string, productId: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('store_id', storeId)
      .eq('id', productId)
      .single();

    if (error) {
      throw new Error(`Tidak dapat menemukan produk dengan ID ${productId}`);
    }

    return data;
  } catch (error) {
    console.error("Error getting product info:", error);
    throw error;
  }
};

import { storeFAQsInPinecone, queryFAQsFromPinecone, deleteFAQFromPinecone } from './pinecone';
import { generateFAQMetadata } from './faqUtils';

// Fungsi untuk membuat tools untuk agent
export const createAgentTools = (storeId: string) => {
  const getProductInfoTool = new DynamicStructuredTool({
    name: "get_product_info",
    description: "Mendapatkan informasi detail tentang produk berdasarkan ID produk",
    schema: z.object({
      productId: z.string().describe("ID produk yang ingin dicari informasinya")
    }),
    func: async ({ productId }) => {
      try {
        const productInfo = await getProductInfo(storeId, productId);
        return JSON.stringify(productInfo, null, 2);
      } catch (error) {
        return `Error: Tidak dapat menemukan informasi untuk produk dengan ID ${productId}`;
      }
    }
  });

  const searchFAQTool = new DynamicStructuredTool({
    name: "search_faq",
    description: "Mencari jawaban dari FAQ berdasarkan pertanyaan",
    schema: z.object({
      question: z.string().describe("Pertanyaan yang ingin dicari jawabannya di FAQ")
    }),
    func: async ({ question }) => {
      try {
        const results = await queryFAQ(storeId, question, 3);
        if (results.length === 0) {
          return "Tidak ditemukan FAQ yang relevan dengan pertanyaan tersebut.";
        }
        let response = "FAQ yang relevan:\n\n";
        results.forEach((doc, index) => {
          const [faqQuestion, answer] = doc.pageContent.split("\n");
          response += `${index + 1}. Q: ${faqQuestion}\nA: ${answer}\n\n`;
        });
        return response;
      } catch (error) {
        return "Error: Tidak dapat mencari FAQ saat ini.";
      }
    }
  });

  const analyzeIntentTool = new DynamicStructuredTool({
    name: "analyze_intent",
    description: "Menganalisis intent dari pesan pelanggan",
    schema: z.object({
      message: z.string().describe("Pesan pelanggan yang ingin dianalisis intent-nya")
    }),
    func: async ({ message }) => {
      try {
        const intent = await analyzeIntentWithLangChain(message);
        return `Intent dari pesan tersebut adalah: ${intent}`;
      } catch (error) {
        return "Error: Tidak dapat menganalisis intent saat ini.";
      }
    }
  });

  const detectEntitiesTool = new DynamicStructuredTool({
    name: "detect_entities",
    description: "Mendeteksi entitas seperti nama produk, harga, jumlah, warna, dan ukuran dari pesan pelanggan",
    schema: z.object({
      message: z.string().describe("Pesan pelanggan yang ingin dideteksi entitasnya")
    }),
    func: async ({ message }) => {
      try {
        const entities = await detectEntities(message);
        return JSON.stringify(entities, null, 2);
      } catch (error) {
        return "Error: Tidak dapat mendeteksi entitas saat ini.";
      }
    }
  });

  return [
    getProductInfoTool,
    searchFAQTool,
    analyzeIntentTool,
    detectEntitiesTool
  ];
};

// Fungsi untuk menganalisis intent dengan LangChain
export const analyzeIntentWithLangChain = async (message: string): Promise<string> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return "UNKNOWN";
    }
    
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0
    });
    
    const prompt = `
    Analisis pesan berikut dan tentukan intent-nya. Pilih salah satu dari kategori berikut:
    - PRODUCT_INQUIRY: Pertanyaan tentang produk, stok, atau ketersediaan
    - PRICE_INQUIRY: Pertanyaan tentang harga
    - SHIPPING_INQUIRY: Pertanyaan tentang pengiriman atau ongkos kirim
    - PAYMENT_INQUIRY: Pertanyaan tentang pembayaran
    - GREETING: Salam atau sapaan
    - UNKNOWN: Tidak termasuk kategori di atas
    
    Pesan: "${message}"
    
    Intent:
    `;
    
    const response = await llm.invoke(prompt);
    return response.content.toString().trim();
  } catch (error) {
    console.error("Error analyzing intent with LangChain:", error);
    return "UNKNOWN";
  }
};

// Fungsi untuk mendeteksi entitas dalam pesan
export const detectEntities = async (message: string): Promise<Record<string, string>> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return {};
    }
    
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0
    });
    
    const prompt = `
    Ekstrak entitas berikut dari pesan:
    - product_name: Nama produk yang disebutkan
    - price: Harga yang disebutkan
    - quantity: Jumlah yang disebutkan
    - color: Warna yang disebutkan
    - size: Ukuran yang disebutkan
    
    Kembalikan dalam format JSON dengan entitas sebagai key dan nilai yang diekstrak sebagai value.
    Jika entitas tidak ditemukan, jangan sertakan dalam JSON.
    
    Pesan: "${message}"
    
    JSON:
    `;
    
    const response = await llm.invoke(prompt);
    const content = response.content.toString().trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.error("Error parsing JSON from response:", error);
        return {};
      }
    }
    
    return {};
  } catch (error) {
    console.error("Error detecting entities:", error);
    return {};
  }
};

// Fungsi untuk mendapatkan respons AI dengan agent dan memory
export const getAiResponseWithAgent = async (
  message: string, 
  userId: string, 
  storeId: string,
  promptName: string = "default",
  productId?: string,
  customerId?: string,
  humanPrompt?: string // Parameter tambahan untuk human prompt
): Promise<string> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key tidak ditemukan");
      return "Maaf, konfigurasi AI belum lengkap. Silakan atur API key terlebih dahulu.";
    }
    
    // Cek apakah AI diaktifkan untuk toko ini
    try {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('ai_enabled')
        .eq('id', storeId)
        .single();
      
      if (storeError) {
        console.warn(`Tidak dapat menemukan toko dengan ID ${storeId}, melanjutkan tanpa pengecekan AI enabled`);
      } else if (!store.ai_enabled) {
        console.warn(`AI tidak diaktifkan untuk toko ${storeId}, tetapi melanjutkan untuk tujuan pengujian`);
        // Untuk pengujian, kita tetap melanjutkan meskipun AI tidak diaktifkan
        // return "Maaf, fitur AI tidak diaktifkan untuk toko ini.";
      }
    } catch (error) {
      console.warn(`Error saat memeriksa status AI untuk toko ${storeId}:`, error);
      // Lanjutkan meskipun ada error untuk tujuan pengujian
    }
    
    // Ambil konfigurasi AI
    const config = await getAIConfig(storeId);
    const prompt = config.customPrompts?.[promptName] || config.systemPrompt;
    
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7")
    });
    
    const sessionId = productId ? `${userId}-${productId}` : userId;
    const history = new Neo4jChatMessageHistory(sessionId, storeId);
    
    const memory = new BufferMemory({
      chatHistory: history,
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input"
    });
    
    const tools = createAgentTools(storeId);
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", prompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad")
    ]);
    
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt: promptTemplate
    });
    
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      memory,
      verbose: true,
      returnIntermediateSteps: false
      // outputKey tidak didukung dalam tipe AgentExecutorInput
    });
    
    let contextMessage = message;
    if (productId) {
      try {
        const product = await getProductInfo(storeId, productId);
        contextMessage = `[Konteks: Saya bertanya tentang produk "${product.name}"] ${message}`;
      } catch (error) {
        console.error("Error getting product info:", error);
      }
    }
    
    // Dapatkan riwayat chat terlebih dahulu
    const pastMessages = await history.getMessages();
    
    // Simpan pesan pengguna ke history
    await history.addUserMessage(contextMessage);
    
    // Gunakan pendekatan dengan ChatOpenAI dan format pesan yang benar
    const llmChain = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7")
    });
    
    // Buat array pesan untuk format yang benar
    const messages = [];
    
    // Buat template untuk prompt sistem
    const enhancedPrompt = `${prompt}\n\nPenting: Jika ada informasi produk yang diberikan dalam format [INFORMASI PRODUK: ...], gunakan informasi tersebut untuk memberikan respons yang relevan dan spesifik tentang produk tersebut. Misalnya, jika informasi produk adalah "freepik premium 1 bulan 30.000" dan pelanggan bertanya "ready min?", berikan respons yang menyebutkan ketersediaan dan harga produk tersebut.`;
    
    // Tambahkan pesan sistem dengan prompt yang ditingkatkan
    messages.push(new HumanMessage(enhancedPrompt));
    
    // Tambahkan riwayat chat ke array pesan
    for (const message of pastMessages) {
      messages.push(message);
    }
    
    // Tambahkan pesan baru dengan human prompt jika disediakan
    if (humanPrompt) {
      // Format yang lebih jelas untuk memberikan konteks produk
      messages.push(new HumanMessage(
        `[INFORMASI PRODUK: ${humanPrompt}]\n\nPertanyaan pelanggan: ${contextMessage}`
      ));
    } else {
      // Jika tidak, gunakan pesan konteks biasa
      messages.push(new HumanMessage(contextMessage));
    }
    
    // Cek apakah pertanyaan terkait dengan FAQ
    let faqContent = "";
    try {
      // Gunakan searchFAQTool untuk mencari FAQ yang relevan
      const searchFAQTool = tools.find(tool => tool.name === "search_faq");
      if (searchFAQTool) {
        // Gunakan cara yang lebih aman untuk memanggil fungsi
        const faqResponse = await (searchFAQTool as any).func({ question: message });
        if (faqResponse && !faqResponse.includes("Tidak ditemukan FAQ")) {
          faqContent = faqResponse;
          console.log("FAQ results found, using as context for AI response");
        }
      }
    } catch (error) {
      console.error("Error searching FAQ:", error);
    }
    
    // Jika FAQ ditemukan, gunakan sebagai konteks untuk AI
    if (faqContent) {
      // Tambahkan informasi FAQ ke dalam prompt untuk AI
      const faqPrompt = `
      Berdasarkan FAQ kami berikut ini:
      ${faqContent}
      
      Berikan respons yang akurat dan ramah untuk pertanyaan pengguna. Gunakan HANYA informasi dari FAQ di atas, jangan tambahkan informasi yang tidak ada di FAQ. Jangan menyebutkan bahwa informasi ini berasal dari FAQ, berikan respons seolah-olah Anda adalah asisten yang mengetahui informasi ini secara langsung.
      
      Pertanyaan pengguna: ${message}
      `;
      
      // Tambahkan prompt FAQ ke messages
      messages.push(new HumanMessage(faqPrompt));
    }
    
    // Panggil LLM dengan format pesan yang benar
    const response = await llmChain.invoke(messages);
    let outputText = response.content.toString();
    
    // Simpan respons AI ke history
    await history.addAIChatMessage(outputText);
    
    // Jika ada customerId, simpan pesan ke tabel messages
    if (customerId) {
      try {
        await supabase.from('messages').insert([
          {
            store_id: storeId,
            customer_id: customerId,
            direction: 'outgoing',
            content: outputText,
            message_type: 'ai',
            ai_response: true,
            created_at: new Date().toISOString()
          }
        ]);
      } catch (error) {
        console.error("Error saving AI response to messages:", error);
      }
    }
    
    await history.close();
    
    return outputText;
  } catch (error) {
    console.error("Error mendapatkan AI response dengan agent:", error);
    // Log informasi lebih detail untuk debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      // Jika error terkait dengan output values, berikan pesan yang lebih spesifik
      if (error.message.includes("output values have")) {
        return "Maaf, terjadi kesalahan saat memproses respons dari AI. Tim teknis kami sedang mengatasi masalah ini.";
      }
    }
    return "Maaf, saya tidak dapat memproses permintaan Anda saat ini. Silakan coba lagi nanti.";
  }
};

// Fungsi untuk membuat respons berdasarkan template
export const generateResponseFromTemplate = async (
  template: string,
  variables: Record<string, string>
): Promise<string> => {
  try {
    let response = template;
    for (const [key, value] of Object.entries(variables)) {
      response = response.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return response;
  } catch (error) {
    console.error("Error generating response from template:", error);
    return "Maaf, saya tidak dapat memproses permintaan Anda saat ini. Silakan coba lagi nanti.";
  }
};

// Fungsi untuk menyimpan template respons
export const saveResponseTemplate = async (
  storeId: string,
  name: string,
  content: string,
  category: string = "general",
  variables: string[] = []
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('response_templates')
      .upsert([
        {
          name,
          content,
          category,
          variables,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'name' });

    if (error) {
      throw error;
    }
    
    console.log(`Template respons "${name}" berhasil disimpan`);
  } catch (error) {
    console.error("Error saving response template:", error);
    throw error;
  }
};

// Fungsi untuk mendapatkan template respons
export const getResponseTemplate = async (
  name: string
): Promise<{ content: string, variables: string[] } | null> => {
  try {
    const { data, error } = await supabase
      .from('response_templates')
      .select('content, variables')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      content: data.content,
      variables: data.variables
    };
  } catch (error) {
    console.error("Error getting response template:", error);
    return null;
  }
};

// Fungsi untuk mendapatkan semua template respons
export const getAllResponseTemplates = async (): Promise<Record<string, { content: string, variables: string[] }>> => {
  try {
    const { data, error } = await supabase
      .from('response_templates')
      .select('name, content, variables');

    if (error) {
      throw error;
    }

    const templates: Record<string, { content: string, variables: string[] }> = {};
    for (const template of data) {
      templates[template.name] = {
        content: template.content,
        variables: template.variables
      };
    }

    return templates;
  } catch (error) {
    console.error("Error getting all response templates:", error);
    return {};
  }
};

// Fungsi untuk menghapus template respons
export const deleteResponseTemplate = async (
  name: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('response_templates')
      .delete()
      .eq('name', name);

    if (error) {
      throw error;
    }
    
    console.log(`Template respons "${name}" berhasil dihapus`);
  } catch (error) {
    console.error("Error deleting response template:", error);
    throw error;
  }
};
