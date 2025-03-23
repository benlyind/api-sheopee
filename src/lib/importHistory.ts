import neo4j, { Driver, Integer } from "neo4j-driver";

interface ChatMessage {
  role: "human" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
}

// Fungsi untuk mengimpor riwayat chat ke Neo4j
export const importChatHistoryToNeo4j = async (
  storeId: string,
  chatHistory: ChatSession[]
): Promise<{ success: boolean, message: string }> => {
  let driver: Driver | null = null;
  
  try {
    // Inisialisasi koneksi Neo4j
    driver = neo4j.driver(
      process.env.NEO4J_URI || "neo4j://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );

    const session = driver.session();
    const results = [];

    // Proses setiap sesi chat
    for (const chat of chatHistory) {
      try {
        // Pastikan conversation node ada untuk sesi ini
        await session.run(
          `
          MERGE (c:Conversation {sessionId: $sessionId, storeId: $storeId})
          ON CREATE SET c.created_at = datetime()
          RETURN c
          `,
          { 
            sessionId: chat.sessionId, 
            storeId: storeId 
          }
        );

        // Tambahkan semua pesan untuk sesi ini
        for (const message of chat.messages) {
          const result = await session.run(
            `
            MATCH (c:Conversation {sessionId: $sessionId, storeId: $storeId})
            CREATE (m:Message {
              type: $type,
              content: $content,
              timestamp: $timestamp
            })
            CREATE (c)-[:HAS_MESSAGE]->(m)
            RETURN m
            `,
            {
              sessionId: chat.sessionId,
              storeId: storeId,
              type: message.role,
              content: message.content,
              timestamp: neo4j.int(message.timestamp)
            }
          );

          results.push({
            success: true,
            messageId: result.records[0].get('m').identity.toString(),
            sessionId: chat.sessionId
          });
        }
      } catch (error) {
        console.error(`Error importing messages for session ${chat.sessionId}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: chat.sessionId
        });
      }
    }

    await session.close();

    // Hitung statistik impor
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      message: `Berhasil mengimpor ${successful} pesan, gagal ${failed} pesan.`
    };

  } catch (error) {
    console.error("Error dalam proses impor:", error);
    return {
      success: false,
      message: `Gagal melakukan impor: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}; 