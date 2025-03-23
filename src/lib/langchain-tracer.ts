import { LangChainTracer } from "langchain/callbacks";
import { Client } from "langsmith";

/**
 * Konfigurasi LangSmith untuk tracing, debugging, dan monitoring aplikasi
 */

// Inisialisasi LangSmith client
export const langSmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  apiKey: process.env.LANGSMITH_API_KEY,
});

// Buat tracer untuk LangChain
export const createLangChainTracer = (runName?: string) => {
  // Periksa apakah tracing diaktifkan
  if (process.env.LANGSMITH_TRACING !== "true") {
    console.log("LangSmith tracing tidak diaktifkan");
    return null;
  }

  try {
    return new LangChainTracer({
      projectName: process.env.LANGSMITH_PROJECT || "default",
      client: langSmithClient,
    });
  } catch (error) {
    console.error("Error membuat LangChain tracer:", error);
    return null;
  }
};

// Fungsi untuk membuat callback handler dengan metadata tambahan
export const createTracingCallbacks = (
  runName: string,
  metadata: Record<string, any> = {}
) => {
  const tracer = createLangChainTracer(runName);
  
  if (!tracer) {
    return [];
  }

  return [tracer];
};

// Fungsi untuk membuat callback handler dengan tag tambahan
export const createTracingCallbacksWithTags = (
  runName: string,
  tags: string[] = [],
  metadata: Record<string, any> = {}
) => {
  const tracer = createLangChainTracer(runName);
  
  if (!tracer) {
    return [];
  }

  return [tracer];
};
