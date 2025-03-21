import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

// GET: Mendapatkan semua template respons
async function getResponseTemplates(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    // Buat query dasar
    let query = supabase
      .from('response_templates')
      .select('*');

    // Tambahkan filter jika ada
    if (category) {
      query = query.eq('category', category);
    }

    // Jalankan query
    const { data: templates, error } = await query;

    if (error) {
      console.error('Error getting response templates:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error getting response templates:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil template respons' },
      { status: 500 }
    );
  }
}

// POST: Membuat atau memperbarui template respons
async function createOrUpdateTemplate(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { id, name, content, category, variables } = body;

    // Validasi input
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Parameter name dan content diperlukan' },
        { status: 400 }
      );
    }

    // Jika id diberikan, perbarui template yang ada
    if (id) {
      const { data: existingTemplate, error: checkError } = await supabase
        .from('response_templates')
        .select('id')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Template tidak ditemukan' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: checkError.message },
          { status: 500 }
        );
      }

      const { data: updatedTemplate, error: updateError } = await supabase
        .from('response_templates')
        .update({
          name,
          content,
          category: category || 'general',
          variables: variables || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(updatedTemplate);
    } else {
      // Buat template baru
      const templateId = uuidv4();
      const { data: newTemplate, error: createError } = await supabase
        .from('response_templates')
        .insert([
          {
            id: templateId,
            name,
            content,
            category: category || 'general',
            variables: variables || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(newTemplate, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating/updating response template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat/memperbarui template respons' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus template respons berdasarkan ID
async function deleteTemplate(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Validasi input
    if (!id) {
      return NextResponse.json(
        { error: 'Parameter id diperlukan' },
        { status: 400 }
      );
    }

    // Cek apakah template ada
    const { data: existingTemplate, error: checkError } = await supabase
      .from('response_templates')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    // Hapus template
    const { error: deleteError } = await supabase
      .from('response_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Template respons berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting response template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus template respons' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getResponseTemplates);
export const POST = withAuth(createOrUpdateTemplate);
export const DELETE = withAuth(deleteTemplate);
