import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET: Mendapatkan detail template respons berdasarkan ID
async function getTemplate(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID template dari URL
    const pathname = request.nextUrl.pathname;
    const templateId = pathname.split('/').pop() || '';

    // Ambil detail template
    const { data: template, error } = await supabase
      .from('response_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error getting template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil detail template' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui template respons berdasarkan ID
async function updateTemplate(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID template dari URL
    const pathname = request.nextUrl.pathname;
    const templateId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { name, content, category, variables } = body;

    // Validasi input
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Parameter name dan content diperlukan' },
        { status: 400 }
      );
    }

    // Cek apakah template ada
    const { data: existingTemplate, error: checkError } = await supabase
      .from('response_templates')
      .select('id')
      .eq('id', templateId)
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

    // Perbarui template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('response_templates')
      .update({
        name,
        content,
        category: category || 'general',
        variables: variables || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui template' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus template respons berdasarkan ID
async function deleteTemplate(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID template dari URL
    const pathname = request.nextUrl.pathname;
    const templateId = pathname.split('/').pop() || '';

    // Cek apakah template ada
    const { data: existingTemplate, error: checkError } = await supabase
      .from('response_templates')
      .select('id')
      .eq('id', templateId)
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
      .eq('id', templateId);

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
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus template' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getTemplate);
export const PUT = withAuth(updateTemplate);
export const DELETE = withAuth(deleteTemplate);
