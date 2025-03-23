import { Client } from "langsmith";
import { z } from "zod";
import { evaluate } from "langsmith/evaluation";
import { zodResponseFormat } from "openai/helpers/zod";
import type { EvaluationResult } from "langsmith/evaluation";
import { getWrappedOpenAIClient } from "./langchain-wrapper";

/**
 * Utilitas untuk evaluasi model AI dengan LangSmith
 * Berdasarkan dokumentasi LangSmith Evaluation Quick Start
 */

// Inisialisasi LangSmith client
export const langSmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  apiKey: process.env.LANGSMITH_API_KEY,
});

// Fungsi untuk membuat dataset evaluasi
export const createEvaluationDataset = async (
  name: string,
  examples: [string, string][],
  description: string = "Dataset evaluasi untuk model AI"
) => {
  try {
    // Format input dan output
    const inputs = examples.map(([inputPrompt]) => ({
      question: inputPrompt,
    }));
    
    const outputs = examples.map(([, outputAnswer]) => ({
      answer: outputAnswer,
    }));

    // Buat dataset di LangSmith
    const dataset = await langSmithClient.createDataset(name, {
      description,
    });

    // Tambahkan contoh ke dataset
    await langSmithClient.createExamples({
      inputs,
      outputs,
      datasetId: dataset.id,
    });

    return dataset;
  } catch (error) {
    console.error("Error membuat dataset evaluasi:", error);
    throw error;
  }
};

// Definisi evaluator akurasi
export const accuracyEvaluator = async ({
  outputs,
  referenceOutputs,
}: {
  outputs?: Record<string, string>;
  referenceOutputs?: Record<string, string>;
}): Promise<EvaluationResult> => {
  try {
    const openai = getWrappedOpenAIClient();
    
    // Definisi instruksi untuk evaluator
    const instructions = `Evaluasi Jawaban Siswa terhadap Kebenaran untuk kesamaan konseptual dan klasifikasikan benar atau salah: 
    - Salah: Tidak ada kecocokan konseptual dan kesamaan
    - Benar: Sebagian besar atau seluruh kecocokan konseptual dan kesamaan
    - Kriteria utama: Konsep harus cocok, bukan kata-kata yang persis sama.
    `;

    // Definisi konteks untuk evaluator
    const context = `Jawaban Benar: {reference}; Jawaban Siswa: {prediction}`;

    // Definisi skema output untuk evaluator
    const ResponseSchema = z.object({
      score: z
        .boolean()
        .describe(
          "Boolean yang menunjukkan apakah respons akurat relatif terhadap jawaban referensi"
        ),
    });

    // Panggil OpenAI untuk evaluasi
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL_NAME || "gpt-4o",
      messages: [
        { role: "system", content: instructions },
        {
          role: "user",
          content: context
            .replace("{prediction}", outputs?.answer || "")
            .replace("{reference}", referenceOutputs?.answer || ""),
        },
      ],
      response_format: zodResponseFormat(ResponseSchema, "response"),
    });

    // Parse hasil evaluasi
    return {
      key: "accuracy",
      score: ResponseSchema.parse(
        JSON.parse(response.choices[0].message.content || "")
      ).score,
    };
  } catch (error) {
    console.error("Error evaluasi akurasi:", error);
    // Return default result with false score
    return {
      key: "accuracy",
      score: false,
    };
  }
};

// Fungsi untuk menjalankan evaluasi
export const runEvaluation = async (
  targetFn: (input: any) => Promise<any>,
  datasetName: string,
  evaluators: any[] = [accuracyEvaluator],
  experimentPrefix: string = "ai-evaluation"
) => {
  try {
    // Jalankan evaluasi
    const result = await evaluate(
      targetFn,
      {
        data: datasetName,
        evaluators,
        experimentPrefix,
        maxConcurrency: 2,
      }
    );

    return result;
  } catch (error) {
    console.error("Error menjalankan evaluasi:", error);
    throw error;
  }
};
