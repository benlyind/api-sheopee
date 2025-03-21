import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan konfigurasi AI
async function getAIConfig(request: AuthenticatedRequest) {
  try {
    // Ambil konfigurasi AI dari database
    const { data: config, error } = await supabase
      .from('ai_config')
      .select('*')
      .single();

    if (error) {
      console.error('Error getting AI config:', error);
      // Jika tidak ada konfigurasi, kembalikan default
      if (error.code === 'PGRST116') {
        const defaultConfig = {
          modelName: "gpt-3.5-turbo",
          temperature: 0.7,
          systemPrompt: "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
          customPrompts: {
            "default": "Anda adalah asisten penjual yang membantu pelanggan dengan pertanyaan mereka tentang produk.",
            "formal": "Anda adalah asisten penjual profesional yang memberikan informasi dengan bahasa formal dan sopan.",
            "casual": "Kamu adalah asisten penjual yang ramah dan menggunakan bahasa santai untuk membantu pelanggan."
          }
        };
        return NextResponse.json(defaultConfig);
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error getting AI config:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil konfigurasi AI' },
      { status: 500 }
    );
  }
}

// POST: Menyimpan konfigurasi AI
async function saveAIConfig(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { modelName, temperature, systemPrompt, customPrompts } = body;

    // Validasi input
    if (!modelName) {
      return NextResponse.json(
        { error: 'Parameter modelName diperlukan' },
        { status: 400 }
      );
    }

    // Cek apakah konfigurasi sudah ada
    const { data: existingConfig, error: checkError } = await supabase
      .from('ai_config')
      .select('id')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    let result;
    if (existingConfig) {
      // Update konfigurasi yang ada
      const { data, error } = await supabase
        .from('ai_config')
        .update({
          model_name: modelName,
          temperature: temperature || 0.7,
          system_prompt: systemPrompt,
          custom_prompts: customPrompts,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Buat konfigurasi baru
      const { data, error } = await supabase
        .from('ai_config')
        .insert([
          {
            model_name: modelName,
            temperature: temperature || 0.7,
            system_prompt: systemPrompt,
            custom_prompts: customPrompts,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error saving AI config:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan konfigurasi AI' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAIConfig);
export const POST = withAuth(saveAIConfig);
