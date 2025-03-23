import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { 
  createEvaluationDataset, 
  runEvaluation, 
  accuracyEvaluator 
} from '@/lib/langchain-evaluation';
import { getWrappedOpenAIClient } from '@/lib/langchain-wrapper';

// POST: Membuat dataset evaluasi
async function createDataset(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { name, examples, description } = body;
    
    // Validasi input
    if (!name || !examples || !Array.isArray(examples)) {
      return NextResponse.json(
        { error: 'Parameter name dan examples diperlukan' },
        { status: 400 }
      );
    }

    // Buat dataset evaluasi
    const dataset = await createEvaluationDataset(name, examples, description);
    
    return NextResponse.json({ 
      message: 'Dataset evaluasi berhasil dibuat',
      dataset 
    });
  } catch (error) {
    console.error('Error creating evaluation dataset:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat dataset evaluasi' },
      { status: 500 }
    );
  }
}

// POST: Menjalankan evaluasi
async function runModelEvaluation(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { datasetName, experimentPrefix, modelName } = body;
    
    // Validasi input
    if (!datasetName) {
      return NextResponse.json(
        { error: 'Parameter datasetName diperlukan' },
        { status: 400 }
      );
    }

    // Definisikan target function untuk evaluasi
    const targetFn = async (inputs: { question: string }): Promise<{ response: string }> => {
      const openai = getWrappedOpenAIClient();
      const response = await openai.chat.completions.create({
        model: modelName || process.env.AI_MODEL_NAME || "gpt-4o",
        messages: [
          { role: "system", content: "Jawab pertanyaan berikut dengan akurat" },
          { role: "user", content: inputs.question },
        ],
      });
      return { response: response.choices[0].message.content?.trim() || "" };
    };

    // Jalankan evaluasi
    const result = await runEvaluation(
      targetFn,
      datasetName,
      [accuracyEvaluator],
      experimentPrefix || 'ai-evaluation'
    );
    
    return NextResponse.json({ 
      message: 'Evaluasi berhasil dijalankan',
      result 
    });
  } catch (error) {
    console.error('Error running evaluation:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menjalankan evaluasi' },
      { status: 500 }
    );
  }
}

// GET: Mendapatkan hasil evaluasi
async function getEvaluationResults(request: AuthenticatedRequest) {
  try {
    // Implementasi untuk mendapatkan hasil evaluasi dari LangSmith
    // Ini memerlukan API tambahan dari LangSmith yang belum diimplementasikan
    
    return NextResponse.json({ 
      message: 'Fitur ini belum diimplementasikan. Silakan lihat hasil evaluasi di dashboard LangSmith.' 
    });
  } catch (error) {
    console.error('Error getting evaluation results:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendapatkan hasil evaluasi' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  // Ambil parameter dari query string
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  // Arahkan ke handler yang sesuai berdasarkan parameter action
  switch (action) {
    case 'create-dataset':
      return createDataset(request);
    case 'run-evaluation':
      return runModelEvaluation(request);
    default:
      return NextResponse.json(
        { error: 'Parameter action tidak valid. Gunakan "create-dataset" atau "run-evaluation"' },
        { status: 400 }
      );
  }
});

export const GET = withAuth(getEvaluationResults);
