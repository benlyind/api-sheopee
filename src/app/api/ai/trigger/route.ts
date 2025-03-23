import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan semua AI trigger milik user
async function getAITriggers(request: AuthenticatedRequest) {
  try {
    // Gunakan Supabase untuk mengambil data
    const { data: aiTriggers, error } = await supabase
      .from('ai_trigger')
      .select('*')
      .eq('user_id', request.user.id);

    if (error) {
      console.error('Error getting AI triggers:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      triggers: aiTriggers.map(trigger => ({
        id: trigger.id,
        intent: trigger.Intent,
        keywords: trigger.Keywords,
        template: trigger.Template
      }))
    });
  } catch (error) {
    console.error('Error getting AI triggers:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mengambil AI triggers' },
      { status: 500 }
    );
  }
}

// POST: Membuat AI trigger baru
async function createAITrigger(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { intent, keywords, template } = body;

    // Validasi input
    if (!template || typeof template !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parameter template diperlukan dan harus berupa string' },
        { status: 400 }
      );
    }

    // Validasi keywords (opsional)
    if (keywords && !Array.isArray(keywords)) {
      return NextResponse.json(
        { success: false, error: 'Parameter keywords harus berupa array' },
        { status: 400 }
      );
    }

    // Buat AI trigger baru menggunakan Supabase
    const { data: newTrigger, error } = await supabase
      .from('ai_trigger')
      .insert([
        {
          user_id: request.user.id,
          Intent: intent || '',
          Keywords: keywords || [],
          Template: template
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating AI trigger:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trigger: {
        id: newTrigger.id,
        intent: newTrigger.Intent,
        keywords: newTrigger.Keywords,
        template: newTrigger.Template
      }
    });
  } catch (error) {
    console.error('Error creating AI trigger:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat membuat AI trigger' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAITriggers);
export const POST = withAuth(createAITrigger);
