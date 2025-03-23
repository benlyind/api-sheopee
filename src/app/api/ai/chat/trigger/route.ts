import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { analyzeIntentWithLangChain, detectEntities } from '@/lib/ai';

// POST: Mendapatkan respons dari AI trigger berdasarkan pesan
async function getAITriggerResponse(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    const userId = request.user.id; // Gunakan user.id dari request yang diautentikasi

    // Validasi input
    if (!message) {
      return NextResponse.json(
        { error: 'Parameter message diperlukan' },
        { status: 400 }
      );
    }

    // Analisis intent dari pesan
    const intent = await analyzeIntentWithLangChain(message);

    // Cari AI trigger berdasarkan intent dan userId
    const { data: triggers, error: triggerError } = await supabase
      .from('ai_trigger')
      .select('*')
      .eq('user_id', userId)
      .eq('Intent', intent);

    if (triggerError) {
      console.error('Error getting AI triggers:', triggerError);
      return NextResponse.json(
        { error: triggerError.message },
        { status: 500 }
      );
    }

    // Jika tidak ada trigger dengan intent yang cocok, cari berdasarkan keywords
    if (!triggers || triggers.length === 0) {
      const { data: keywordTriggers, error: keywordError } = await supabase
        .from('ai_trigger')
        .select('*')
        .eq('user_id', userId);

      if (keywordError) {
        console.error('Error getting AI triggers by keywords:', keywordError);
        return NextResponse.json(
          { error: keywordError.message },
          { status: 500 }
        );
      }

      // Filter trigger berdasarkan keywords yang cocok dengan pesan
      const matchedTriggers = keywordTriggers.filter(trigger => {
        if (!trigger.Keywords || trigger.Keywords.length === 0) {
          return false;
        }
        
        const messageLower = message.toLowerCase();
        return trigger.Keywords.some((keyword: string) => 
          messageLower.includes(keyword.toLowerCase())
        );
      });

      if (matchedTriggers.length > 0) {
        // Gunakan trigger pertama yang cocok
        const trigger = matchedTriggers[0];
        
        // Proses template untuk mengganti placeholder
        let response = trigger.Template;
        
        // Ekstrak entitas dari pesan jika ada placeholder dalam template
        if (response.includes('{{')) {
          try {
            // Ekstrak nama placeholder dari template
            const placeholders = response.match(/\{\{([^}]+)\}\}/g) || [];
            const placeholderNames = placeholders.map((p: string) => p.replace(/\{\{|\}\}/g, ''));
            
            // Deteksi entitas dari pesan
            const entities = await detectEntities(message);
            
            // Buat objek dengan nilai default untuk placeholder
            const replacements: Record<string, string> = {};
            placeholderNames.forEach((name: string) => {
              // Gunakan entitas yang terdeteksi jika ada, jika tidak gunakan nilai default
              if (entities && entities[name]) {
                replacements[name] = entities[name];
              } else {
                replacements[name] = `[${name}]`;
              }
            });
            
            // Ganti placeholder dengan nilai
            placeholderNames.forEach((name: string) => {
              const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
              response = response.replace(regex, replacements[name]);
            });
          } catch (error) {
            console.error('Error processing template:', error);
          }
        }
        
        return NextResponse.json({
          success: true,
          response,
          trigger: {
            id: trigger.id,
            intent: trigger.Intent,
            keywords: trigger.Keywords
          },
          matchType: 'keyword'
        });
      }
      
      // Jika tidak ada trigger yang cocok, kembalikan respons default
      return NextResponse.json({
        success: false,
        error: 'Tidak ada AI trigger yang cocok dengan pesan',
        intent
      });
    }
    
    // Gunakan trigger pertama yang cocok dengan intent
    const trigger = triggers[0];
    
    // Proses template untuk mengganti placeholder
    let response = trigger.Template;
    
    // Ekstrak entitas dari pesan jika ada placeholder dalam template
    if (response.includes('{{')) {
      try {
        // Ekstrak nama placeholder dari template
        const placeholders = response.match(/\{\{([^}]+)\}\}/g) || [];
        const placeholderNames = placeholders.map((p: string) => p.replace(/\{\{|\}\}/g, ''));
        
        // Deteksi entitas dari pesan
        const entities = await detectEntities(message);
        
        // Buat objek dengan nilai default untuk placeholder
        const replacements: Record<string, string> = {};
        placeholderNames.forEach((name: string) => {
          // Gunakan entitas yang terdeteksi jika ada, jika tidak gunakan nilai default
          if (entities && entities[name]) {
            replacements[name] = entities[name];
          } else {
            replacements[name] = `[${name}]`;
          }
        });
        
        // Ganti placeholder dengan nilai
        placeholderNames.forEach((name: string) => {
          const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
          response = response.replace(regex, replacements[name]);
        });
      } catch (error) {
        console.error('Error processing template:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      response,
      trigger: {
        id: trigger.id,
        intent: trigger.Intent,
        keywords: trigger.Keywords
      },
      matchType: 'intent'
    });
  } catch (error) {
    console.error('Error getting AI trigger response:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mendapatkan respons AI trigger' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(getAITriggerResponse);
