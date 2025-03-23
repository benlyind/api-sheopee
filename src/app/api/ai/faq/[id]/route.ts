import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { updateFAQVectorStore } from '@/lib/faq';
import { generateFAQMetadata } from '@/lib/faqUtils';

// Define interfaces for type safety
interface QuestionData {
  id: string;
  question: string;
  answer: string;
  category: string;
  tag: string;
}

interface FAQDocumentData {
  id: string;
  store_id: string;
  question_id: string;
  created_at: string;
  updated_at: string;
  question: QuestionData;
}

// GET: Mendapatkan detail FAQ berdasarkan ID
async function getFAQ(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID FAQ dari URL
    const pathname = request.nextUrl.pathname;
    const faqId = pathname.split('/').pop() || '';
    
    // Ambil storeId dari query parameter
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const storeIdsParam = searchParams.get('storeIds');
    
    // Tentukan storeIds yang akan digunakan
    let storeIds: string[] = [];
    
    if (storeId) {
      // Jika storeId diberikan, gunakan sebagai single store
      storeIds = [storeId];
    } else if (storeIdsParam) {
      // Jika storeIds diberikan, parse sebagai array
      try {
        const parsed = JSON.parse(storeIdsParam);
        if (Array.isArray(parsed)) {
          storeIds = parsed;
        } else {
          // Jika bukan array, gunakan sebagai single value
          storeIds = [storeIdsParam];
        }
      } catch (error) {
        // Jika parsing gagal, anggap sebagai comma-separated string
        storeIds = storeIdsParam.split(',').map(id => id.trim());
      }
    }
    
    // Validasi storeIds
    if (storeIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Parameter storeId atau storeIds diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke semua toko yang ditentukan
    for (const id of storeIds) {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('id', id)
        .eq('user_id', request.user.id)
        .single();

      if (storeError) {
        return NextResponse.json(
          { success: false, message: `Anda tidak memiliki akses ke toko dengan ID ${id}` },
          { status: 403 }
        );
      }
    }

    // Ambil detail FAQ dengan join ke tabel question
    const { data, error } = await supabase
      .from('faq_documents')
      .select(`
        id,
        store_id,
        question_id,
        created_at,
        updated_at,
        question:question_id (
          id,
          question,
          answer,
          category,
          tag
        )
      `)
      .eq('id', faqId)
      .in('store_id', storeIds);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, message: 'FAQ tidak ditemukan' },
        { status: 404 }
      );
    }

    // Cast data to our interface for type safety
    const faqs = data as unknown as FAQDocumentData[];

    // Format ulang hasil untuk mempertahankan kompatibilitas dengan frontend
    const formattedFaqs = faqs.map(faq => {
      return {
        id: faq.id,
        store_id: faq.store_id,
        question: faq.question ? faq.question.question : null,
        answer: faq.question ? faq.question.answer : null,
        category: faq.question ? faq.question.category : null,
        tags: faq.question && faq.question.tag ? [faq.question.tag] : [], // Ubah tag menjadi array tags untuk kompatibilitas
        created_at: faq.created_at,
        updated_at: faq.updated_at,
        question_id: faq.question_id
      };
    });

    // Jika hanya ada satu toko, kembalikan respons sederhana
    if (storeIds.length === 1) {
      return NextResponse.json({ 
        success: true,
        faq: formattedFaqs[0] 
      });
    }
    
    // Jika ada beberapa toko, kembalikan array FAQ
    return NextResponse.json({ 
      success: true,
      faqs: formattedFaqs 
    });
  } catch (error) {
    console.error('Error getting FAQ:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat mengambil detail FAQ' },
      { status: 500 }
    );
  }
}

// PUT: Memperbarui FAQ berdasarkan ID
async function updateFAQ(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID FAQ dari URL
    const pathname = request.nextUrl.pathname;
    const faqId = pathname.split('/').pop() || '';
    
    const body = await request.json();
    const { question, answer, category, tags, storeId, storeIds } = body;

    // Validasi input
    if (!question || !answer) {
      return NextResponse.json(
        { success: false, message: 'Parameter question dan answer diperlukan' },
        { status: 400 }
      );
    }

    // Tentukan storeIds yang akan digunakan
    let targetStoreIds: string[] = [];
    
    if (storeId) {
      // Jika storeId diberikan, gunakan sebagai single store
      targetStoreIds = [storeId];
    } else if (storeIds) {
      // Jika storeIds diberikan, gunakan sebagai array
      targetStoreIds = Array.isArray(storeIds) ? storeIds : [storeIds];
    }
    
    // Validasi storeIds
    if (targetStoreIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Parameter storeId atau storeIds diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke semua toko yang ditentukan
    for (const id of targetStoreIds) {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('id', id)
        .eq('user_id', request.user.id)
        .single();

      if (storeError) {
        return NextResponse.json(
          { success: false, message: `Anda tidak memiliki akses ke toko dengan ID ${id}` },
          { status: 403 }
        );
      }
    }

    // Cek apakah FAQ ada di salah satu toko yang ditentukan
    const { data: existingFAQs, error: checkError } = await supabase
      .from('faq_documents')
      .select('id, store_id, question_id')
      .eq('id', faqId)
      .in('store_id', targetStoreIds);

    if (checkError) {
      return NextResponse.json(
        { success: false, message: checkError.message },
        { status: 500 }
      );
    }

    if (!existingFAQs || existingFAQs.length === 0) {
      return NextResponse.json(
        { success: false, message: 'FAQ tidak ditemukan di toko yang ditentukan' },
        { status: 404 }
      );
    }

    // Ambil question_id dari FAQ pertama yang ditemukan
    const questionId = existingFAQs[0].question_id;
    
    // Persiapkan metadata
    let categoryValue = category || '';
    let tagValues = Array.isArray(tags) ? tags : [];
    let tagValue = tagValues.length > 0 ? tagValues[0] : '';
    
    // Generate metadata jika perlu
    if (!categoryValue || !tagValue) {
      try {
        console.log("Menghasilkan metadata otomatis untuk FAQ...");
        const metadata = await generateFAQMetadata(question, answer);
        
        if (!tagValue) {
          tagValue = metadata.tag;
          console.log(`Tag yang dihasilkan: ${tagValue}`);
        }
        
        if (!categoryValue) {
          categoryValue = metadata.category;
          console.log(`Kategori yang dihasilkan: ${categoryValue}`);
        }
      } catch (error) {
        console.error("Error generating metadata:", error);
        // Proceed with empty values if generation fails
      }
    }
    
    // Perbarui data question terlebih dahulu
    const { data: questionData, error: questionError } = await supabase
      .from('question')
      .update({
        question: question,
        answer: answer,
        category: categoryValue,
        tag: tagValue
      })
      .eq('id', questionId)
      .select();
    
    if (questionError) {
      return NextResponse.json(
        { success: false, message: `Error saat memperbarui question: ${questionError.message}` },
        { status: 500 }
      );
    }
    
    // Pastikan questionData tidak kosong
    if (!questionData || questionData.length === 0) {
      return NextResponse.json(
        { success: false, message: "Gagal memperbarui question: Tidak ada data yang dikembalikan" },
        { status: 500 }
      );
    }
    
    // Ambil data question pertama
    const questionDataItem = questionData[0];

    // Perbarui faq_document untuk setiap toko
    const results = [];
    
    for (const targetStoreId of targetStoreIds) {
      try {
        // Cek apakah FAQ ada di toko ini
        const existingFAQ = existingFAQs.find(faq => faq.store_id === targetStoreId);
        
        if (!existingFAQ) {
          results.push({
            storeId: targetStoreId,
            success: false,
            message: 'FAQ tidak ditemukan di toko ini'
          });
          continue;
        }
        
        // Perbarui faq_document
        const { data: updatedFAQ, error: updateError } = await supabase
          .from('faq_documents')
          .update({
            updated_at: new Date().toISOString()
          })
          .eq('id', faqId)
          .eq('store_id', targetStoreId)
          .select()
          .single();

        if (updateError) {
          results.push({
            storeId: targetStoreId,
            success: false,
            message: updateError.message
          });
          continue;
        }

        // Format hasil untuk dikembalikan
        results.push({
          storeId: targetStoreId,
          success: true,
          faq: {
            id: updatedFAQ.id,
            store_id: updatedFAQ.store_id,
            question_id: questionId,
            question: questionDataItem.question,
            answer: questionDataItem.answer,
            category: questionDataItem.category,
            tags: [questionDataItem.tag],
            created_at: updatedFAQ.created_at,
            updated_at: updatedFAQ.updated_at
          }
        });
        
        // Update vector store untuk FAQ
        try {
          await updateFAQVectorStore(targetStoreId);
        } catch (error) {
          console.error(`Error updating FAQ vector store for storeId ${targetStoreId}:`, error);
          // Lanjutkan meskipun ada error pada vector store
        }
      } catch (error) {
        console.error(`Error updating FAQ for storeId ${targetStoreId}:`, error);
        results.push({
          storeId: targetStoreId,
          success: false,
          message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui FAQ'
        });
      }
    }
    
    // Jika hanya ada satu toko, kembalikan respons sederhana
    if (targetStoreIds.length === 1) {
      const result = results[0];
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'FAQ berhasil diperbarui',
          faq: result.faq
        });
      } else {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 500 }
        );
      }
    }
    
    // Jika ada beberapa toko, kembalikan respons batch
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: successCount > 0,
      message: `FAQ berhasil diperbarui di ${successCount} toko, gagal di ${failureCount} toko`,
      results
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memperbarui FAQ' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus FAQ berdasarkan ID
async function deleteFAQ(request: AuthenticatedRequest) {
  try {
    // Ekstrak ID FAQ dari URL
    const pathname = request.nextUrl.pathname;
    const faqId = pathname.split('/').pop() || '';
    
    // Ambil storeId dari query parameter
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const storeIdsParam = searchParams.get('storeIds');
    
    // Tentukan storeIds yang akan digunakan
    let storeIds: string[] = [];
    
    if (storeId) {
      // Jika storeId diberikan, gunakan sebagai single store
      storeIds = [storeId];
    } else if (storeIdsParam) {
      // Jika storeIds diberikan, parse sebagai array
      try {
        const parsed = JSON.parse(storeIdsParam);
        if (Array.isArray(parsed)) {
          storeIds = parsed;
        } else {
          // Jika bukan array, gunakan sebagai single value
          storeIds = [storeIdsParam];
        }
      } catch (error) {
        // Jika parsing gagal, anggap sebagai comma-separated string
        storeIds = storeIdsParam.split(',').map(id => id.trim());
      }
    }
    
    // Validasi storeIds
    if (storeIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Parameter storeId atau storeIds diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke semua toko yang ditentukan
    for (const id of storeIds) {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('id', id)
        .eq('user_id', request.user.id)
        .single();

      if (storeError) {
        return NextResponse.json(
          { success: false, message: `Anda tidak memiliki akses ke toko dengan ID ${id}` },
          { status: 403 }
        );
      }
    }

    // Cek apakah FAQ ada di salah satu toko yang ditentukan
    const { data: existingFAQs, error: checkError } = await supabase
      .from('faq_documents')
      .select('id, store_id, question_id')
      .eq('id', faqId)
      .in('store_id', storeIds);

    if (checkError) {
      return NextResponse.json(
        { success: false, message: checkError.message },
        { status: 500 }
      );
    }

    if (!existingFAQs || existingFAQs.length === 0) {
      return NextResponse.json(
        { success: false, message: 'FAQ tidak ditemukan di toko yang ditentukan' },
        { status: 404 }
      );
    }

    // Simpan question_id untuk pengecekan nanti
    const questionId = existingFAQs[0].question_id;
    
    // Proses penghapusan untuk setiap toko
    const results = [];
    
    for (const targetStoreId of storeIds) {
      try {
        // Cek apakah FAQ ada di toko ini
        const existingFAQ = existingFAQs.find(faq => faq.store_id === targetStoreId);
        
        if (!existingFAQ) {
          results.push({
            storeId: targetStoreId,
            success: false,
            message: 'FAQ tidak ditemukan di toko ini'
          });
          continue;
        }
        
        // Hapus FAQ dari faq_documents
        const { error: deleteError } = await supabase
          .from('faq_documents')
          .delete()
          .eq('id', faqId)
          .eq('store_id', targetStoreId);

        if (deleteError) {
          results.push({
            storeId: targetStoreId,
            success: false,
            message: deleteError.message
          });
          continue;
        }

        // Update vector store untuk FAQ
        try {
          await updateFAQVectorStore(targetStoreId);
        } catch (error) {
          console.error(`Error updating FAQ vector store for storeId ${targetStoreId}:`, error);
          // Lanjutkan meskipun ada error pada vector store
        }

        results.push({
          storeId: targetStoreId,
          success: true,
          message: 'FAQ berhasil dihapus'
        });
      } catch (error) {
        console.error(`Error deleting FAQ for storeId ${targetStoreId}:`, error);
        results.push({
          storeId: targetStoreId,
          success: false,
          message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus FAQ'
        });
      }
    }
    
    // Cek apakah question_id masih digunakan di faq_documents lain
    const { data: otherFAQs, error: otherFAQsError } = await supabase
      .from('faq_documents')
      .select('id')
      .eq('question_id', questionId);

    if (!otherFAQsError && (!otherFAQs || otherFAQs.length === 0)) {
      // Jika tidak ada faq_documents lain yang menggunakan question_id ini,
      // hapus juga record di tabel question
      const { error: deleteQuestionError } = await supabase
        .from('question')
        .delete()
        .eq('id', questionId);

      if (deleteQuestionError) {
        console.error('Error deleting question:', deleteQuestionError);
        // Lanjutkan meskipun ada error saat menghapus question
      }
    }

    // Jika hanya ada satu toko, kembalikan respons sederhana
    if (storeIds.length === 1) {
      const result = results[0];
      if (result.success) {
        return NextResponse.json(
          { success: true, message: 'FAQ berhasil dihapus' },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 500 }
        );
      }
    }
    
    // Jika ada beberapa toko, kembalikan respons batch
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: successCount > 0,
      message: `FAQ berhasil dihapus dari ${successCount} toko, gagal untuk ${failureCount} toko`,
      results
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat menghapus FAQ' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getFAQ);
export const PUT = withAuth(updateFAQ);
export const DELETE = withAuth(deleteFAQ);
