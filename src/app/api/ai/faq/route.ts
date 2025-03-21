import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { saveFAQDocument, getFAQDocument, updateFAQVectorStore } from '@/lib/faq';

// GET: Mendapatkan semua FAQ
async function getFAQs(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const storeId = searchParams.get('storeId');
    
    // Validasi storeId
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke store ini
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', request.user.id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Buat query dasar
    let query = supabase
      .from('faq_documents')
      .select('*')
      .eq('store_id', storeId);

    // Tambahkan filter jika ada
    if (category) {
      query = query.eq('category', category);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // Jalankan query
    const { data: faqs, error } = await query;

    if (error) {
      console.error('Error getting FAQs:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ faqs });
  } catch (error) {
    console.error('Error getting FAQs:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil FAQ' },
      { status: 500 }
    );
  }
}

// POST: Membuat atau memperbarui FAQ (single atau batch)
async function createOrUpdateFAQ(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    
    // Cek apakah ini adalah permintaan batch (array) atau single FAQ
    const isBatchRequest = Array.isArray(body);
    
    // Jika ini adalah permintaan batch
    if (isBatchRequest) {
      // Validasi bahwa array tidak kosong
      if (body.length === 0) {
        return NextResponse.json(
          { error: 'Array FAQ tidak boleh kosong' },
          { status: 400 }
        );
      }
      
      // Proses batch FAQ menggunakan saveFAQDocument
      const results = [];
      
      for (const faq of body) {
        try {
          // Validasi input
          if (!faq.question || !faq.answer) {
            results.push({
              id: faq.id,
              success: false,
              error: 'Parameter question dan answer diperlukan'
            });
            continue;
          }
          
          // Ambil storeIds untuk FAQ ini (bisa berupa string atau array)
          const storeIds = Array.isArray(faq.storeIds) 
            ? faq.storeIds 
            : (faq.storeId ? [faq.storeId] : []);
          
          // Validasi storeIds
          if (storeIds.length === 0) {
            results.push({
              id: faq.id,
              success: false,
              error: 'Parameter storeIds atau storeId diperlukan'
            });
            continue;
          }
          
          // Verifikasi bahwa user memiliki akses ke semua toko
          let hasAccessToAllStores = true;
          for (const storeId of storeIds) {
            const { data: store, error: storeError } = await supabase
              .from('stores')
              .select('id')
              .eq('id', storeId)
              .eq('user_id', request.user.id)
              .single();

            if (storeError) {
              results.push({
                id: faq.id,
                success: false,
                error: `Anda tidak memiliki akses ke toko dengan ID ${storeId}`
              });
              hasAccessToAllStores = false;
              break;
            }
          }
          
          if (!hasAccessToAllStores) {
            continue;
          }
          
          // Simpan FAQ untuk setiap storeId
          for (const storeId of storeIds) {
            const faqId = faq.id || uuidv4();
            
            await saveFAQDocument({
              id: faqId,
              storeId: storeId,
              question: faq.question,
              answer: faq.answer,
              category: faq.category || '', // Kosong akan digenerate oleh AI
              tags: faq.tags || [] // Kosong akan digenerate oleh AI
            });
            
            // Ambil FAQ yang baru disimpan untuk mendapatkan kategori dan tag yang dihasilkan
            const savedFAQ = await getFAQDocument(storeId, faqId);
            
            results.push({
              id: faqId,
              storeId: storeId,
              success: true,
              operation: faq.id ? 'updated' : 'created',
              faq: savedFAQ
            });
          }
        } catch (error) {
          console.error(`Error processing FAQ:`, error);
          results.push({
            id: faq.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Hitung jumlah sukses dan gagal
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      return NextResponse.json({
        message: `Batch FAQ berhasil diproses: ${successCount} sukses, ${failureCount} gagal`,
        results
      }, { status: 201 });
    } else {
      // Ini adalah permintaan single FAQ
      const { id, question, answer, category, tags, storeId, storeIds } = body;

      // Validasi input
      if (!question || !answer) {
        return NextResponse.json(
          { error: 'Parameter question dan answer diperlukan' },
          { status: 400 }
        );
      }

      // Ambil storeIds (bisa berupa string atau array)
      const targetStoreIds = Array.isArray(storeIds) 
        ? storeIds 
        : (storeId ? [storeId] : []);
      
      // Validasi storeIds
      if (targetStoreIds.length === 0) {
        return NextResponse.json(
          { error: 'Parameter storeIds atau storeId diperlukan' },
          { status: 400 }
        );
      }
      
      // Verifikasi bahwa user memiliki akses ke semua toko
      for (const targetStoreId of targetStoreIds) {
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('id', targetStoreId)
          .eq('user_id', request.user.id)
          .single();

        if (storeError) {
          return NextResponse.json(
            { error: `Anda tidak memiliki akses ke toko dengan ID ${targetStoreId}` },
            { status: 403 }
          );
        }
      }

      // Simpan FAQ untuk setiap storeId
      const results = [];
      
      for (const targetStoreId of targetStoreIds) {
        const faqId = id || uuidv4();
        
        try {
          await saveFAQDocument({
            id: faqId,
            storeId: targetStoreId,
            question,
            answer,
            category: category || '', // Kosong akan digenerate oleh AI
            tags: tags || [] // Kosong akan digenerate oleh AI
          });
          
          // Ambil FAQ yang baru disimpan untuk mendapatkan kategori dan tag yang dihasilkan
          const savedFAQ = await getFAQDocument(targetStoreId, faqId);
          
          results.push({
            id: faqId,
            storeId: targetStoreId,
            success: true,
            operation: id ? 'updated' : 'created',
            faq: savedFAQ
          });
        } catch (error) {
          console.error('Error saving FAQ:', error);
          results.push({
            id: faqId,
            storeId: targetStoreId,
            success: false,
            error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan FAQ'
          });
        }
      }
      
      // Jika hanya ada satu toko, kembalikan respons sederhana
      if (targetStoreIds.length === 1) {
        const result = results[0];
        if (result.success) {
          return NextResponse.json({
            message: id ? 'FAQ berhasil diperbarui' : 'FAQ berhasil ditambahkan',
            faq: result.faq
          }, { status: id ? 200 : 201 });
        } else {
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          );
        }
      }
      
      // Jika ada beberapa toko, kembalikan respons batch
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      return NextResponse.json({
        message: `FAQ berhasil diproses untuk ${successCount} toko, gagal untuk ${failureCount} toko`,
        results
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating/updating FAQ:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat/memperbarui FAQ' },
      { status: 500 }
    );
  }
}

// DELETE: Menghapus FAQ berdasarkan ID
async function deleteFAQ(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const storeId = searchParams.get('storeId');

    // Validasi input
    if (!id) {
      return NextResponse.json(
        { error: 'Parameter id diperlukan' },
        { status: 400 }
      );
    }

    // Validasi storeId
    if (!storeId) {
      return NextResponse.json(
        { error: 'Parameter storeId diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi bahwa user memiliki akses ke store ini
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', request.user.id)
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke toko ini' },
        { status: 403 }
      );
    }

    // Cek apakah FAQ ada dan milik toko yang benar
    const { data: existingFAQ, error: checkError } = await supabase
      .from('faq_documents')
      .select('id, store_id')
      .eq('id', id)
      .eq('store_id', storeId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'FAQ tidak ditemukan' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    // Hapus FAQ
    const { error: deleteError } = await supabase
      .from('faq_documents')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Update vector store untuk FAQ
    try {
      await updateFAQVectorStore(storeId);
    } catch (error) {
      console.error('Error updating FAQ vector store:', error);
      // Lanjutkan meskipun ada error pada vector store
    }

    return NextResponse.json(
      { message: 'FAQ berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus FAQ' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getFAQs);
export const POST = withAuth(createOrUpdateFAQ);
export const DELETE = withAuth(deleteFAQ);
