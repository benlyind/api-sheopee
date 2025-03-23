import { OpenAI } from "openai";
import { wrapOpenAI } from "langsmith/wrappers";
import { traceable } from "langsmith/traceable";

/**
 * Utilitas untuk wrapping OpenAI dan fungsi-fungsi lain dengan LangSmith
 * Berdasarkan dokumentasi LangSmith Observability Quick Start
 */

// Fungsi untuk mendapatkan wrapped OpenAI client
export const getWrappedOpenAIClient = () => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("OpenAI API key tidak ditemukan");
    throw new Error("OpenAI API key tidak ditemukan");
  }

  return wrapOpenAI(new OpenAI({
    apiKey: openaiApiKey
  }));
};

// Fungsi untuk membuat fungsi traceable
export function makeTraceable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  metadata: Record<string, any> = {}
): T {
  const wrappedFn = traceable(fn);
  // Tambahkan nama dan metadata ke fungsi yang sudah di-wrap
  (wrappedFn as any).__name = name;
  (wrappedFn as any).__metadata = metadata;
  return wrappedFn as T;
}

// Contoh penggunaan untuk wrapping fungsi AI
export const traceableAnalyzeIntent = (analyzeIntentFn: any) => {
  return makeTraceable(analyzeIntentFn, "analyze_intent", {
    description: "Menganalisis intent dari pesan pelanggan",
    tags: ["intent", "analysis"]
  });
};

export const traceableDetectEntities = (detectEntitiesFn: any) => {
  return makeTraceable(detectEntitiesFn, "detect_entities", {
    description: "Mendeteksi entitas dalam pesan pelanggan",
    tags: ["entity", "detection"]
  });
};

export const traceableGetAiResponse = (getAiResponseFn: any) => {
  return makeTraceable(getAiResponseFn, "get_ai_response", {
    description: "Mendapatkan respons AI dengan agent dan memory",
    tags: ["chat", "agent", "response"]
  });
};
