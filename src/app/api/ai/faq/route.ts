import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { saveFAQDocument, getFAQDocument, updateFAQVectorStore } from '@/lib/faq';
import { generateFAQMetadata } from '@/lib/faqUtils';

// Define interfaces for type safety
interface QuestionData {
  id: string;
  question: string;
  answer: string;
  category: string;
  tag: string[];
}

interface FAQDocumentData {
  id: string;
  store_id: string;
  question_id: string;
  created_at: string;
  updated_at: string;
  question: QuestionData;
}

// GET: Mendapatkan semua FAQ
async function getFAQs(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
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

    // Buat query untuk mengambil FAQ dengan join ke tabel question
    let query = supabase
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
      .in('store_id', storeIds); // Gunakan operator .in() untuk multiple storeIds

    // Tambahkan filter jika ada
    if (category) {
      query = query.eq('question.category', category);
    }
    if (tag) {
      query = query.eq('question.tag', tag);
    }

    // Jalankan query
    const { data, error } = await query;

    if (error) {
      console.error('Error getting FAQs:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // Cast data to our interface for type safety
    const faqs = data as unknown as FAQDocumentData[];

    // Format ulang hasil untuk mempertahankan kompatibilitas dengan frontend
    const formattedFaqs = faqs ? faqs.map(faq => {
      return {
        id: faq.id,
        store_id: faq.store_id,
        question: faq.question ? faq.question.question : null,
        answer: faq.question ? faq.question.answer : null,
        category: faq.question ? faq.question.category : null,
        tags: faq.question && faq.question.tag ? faq.question.tag : [],
        created_at: faq.created_at,
        updated_at: faq.updated_at,
        question_id: faq.question_id
      };
    }) : [];

    return NextResponse.json({ 
      success: true,
      faqs: formattedFaqs 
    });
  } catch (error) {
    console.error('Error getting FAQs:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat mengambil FAQ' },
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
          { success: false, message: 'Array FAQ tidak boleh kosong' },
          { status: 400 }
        );
      }
      
      // Proses batch FAQ
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
          
          // Buat atau update record question terlebih dahulu
          const questionId = faq.question_id || uuidv4();
          let category = faq.category || '';
          let questionTags = Array.isArray(faq.tags) ? faq.tags : [];
          
          // Generate metadata jika perlu
          if (!category || questionTags.length === 0) {
            try {
              console.log("Menghasilkan metadata otomatis untuk FAQ...");
              const metadata = await generateFAQMetadata(faq.question, faq.answer);
              
              if (questionTags.length === 0) {
                questionTags = metadata.tags;
                console.log(`Tags yang dihasilkan: ${questionTags.join(', ')}`);
              }
              
              if (!category) {
                category = metadata.category;
                console.log(`Kategori yang dihasilkan: ${category}`);
              }
            } catch (error) {
              console.error("Error generating metadata:", error);
              questionTags = [];
            }
          }
          
          const { data: questionData, error: questionError } = await supabase
            .from('question')
            .upsert({
              id: questionId,
              question: faq.question,
              answer: faq.answer,
              category: category,
              tag: questionTags
            })
            .select();
          
          if (questionError) {
            results.push({
              id: faq.id,
              success: false,
              error: `Error saat menyimpan question: ${questionError.message}`
            });
            continue;
          }
          
          // Pastikan questionData tidak kosong
          if (!questionData || questionData.length === 0) {
            results.push({
              id: faq.id,
              success: false,
              error: "Gagal menyimpan question: Tidak ada data yang dikembalikan"
            });
            continue;
          }
          
          // Ambil data question pertama
          const questionDataItem = questionData[0];
          
          // Simpan faq_document untuk setiap storeId
          for (const storeId of storeIds) {
            const faqId = faq.id || uuidv4();
            
            const { data: faqData, error: faqError } = await supabase
              .from('faq_documents')
              .upsert({
                id: faqId,
                store_id: storeId,
                question_id: questionId,
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (faqError) {
              results.push({
                id: faqId,
                storeId: storeId,
                success: false,
                error: `Error saat menyimpan faq_document: ${faqError.message}`
              });
              continue;
            }
            
            // Format hasil untuk dikembalikan
            results.push({
              id: faqId,
              storeId: storeId,
              success: true,
              operation: faq.id ? 'updated' : 'created',
              faq: {
                id: faqId,
                store_id: storeId,
                question_id: questionId,
                question: questionDataItem.question,
                answer: questionDataItem.answer,
                category: questionDataItem.category,
                tags: questionDataItem.tag,
                created_at: faqData.created_at,
                updated_at: faqData.updated_at
              }
            });
            
            // Update vector store untuk FAQ
            try {
              await updateFAQVectorStore(storeId);
            } catch (error) {
              console.error(`Error updating FAQ vector store for storeId ${storeId}:`, error);
              // Lanjutkan meskipun ada error pada vector store
            }
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
        success: successCount > 0,
        message: `Batch FAQ berhasil diproses: ${successCount} sukses, ${failureCount} gagal`,
        results
      }, { status: 201 });
    } else {
      // Ini adalah permintaan single FAQ
      const { id, question_id, question, answer, category, tags, storeId, storeIds } = body;

      // Validasi input
      if (!question || !answer) {
        return NextResponse.json(
          { success: false, message: 'Parameter question dan answer diperlukan' },
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
          { success: false, message: 'Parameter storeIds atau storeId diperlukan' },
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
            { success: false, message: `Anda tidak memiliki akses ke toko dengan ID ${targetStoreId}` },
            { status: 403 }
          );
        }
      }

      // Buat atau update record question terlebih dahulu
      const questionIdValue = question_id || uuidv4();
      let categoryValue = category || '';
      let updatedTags = Array.isArray(body.tags) ? body.tags : [];
      
      // Generate metadata jika perlu
      if (!categoryValue || updatedTags.length === 0) {
        try {
          console.log("Menghasilkan metadata otomatis untuk FAQ...");
          const metadata = await generateFAQMetadata(question, answer);
          
          if (updatedTags.length === 0) {
            updatedTags = metadata.tags;
            console.log(`Tags yang dihasilkan: ${updatedTags.join(', ')}`);
          }
          
          if (!categoryValue) {
            categoryValue = metadata.category;
            console.log(`Kategori yang dihasilkan: ${categoryValue}`);
          }
        } catch (error) {
          console.error("Error generating metadata:", error);
          updatedTags = [];
        }
      }
      
          // Cek apakah question sudah ada
          const { data: existingQuestion, error: checkError } = await supabase
            .from('question')
            .select('id')
            .eq('id', questionIdValue)
            .maybeSingle();
            
          if (checkError) {
            return NextResponse.json(
              { success: false, message: `Error saat memeriksa question: ${checkError.message}` },
              { status: 500 }
            );
          }
          
          let questionData;
          
          if (!existingQuestion) {
            // Jika question belum ada, lakukan insert
            const { data: insertedData, error: insertError } = await supabase
              .from('question')
              .insert({
                id: questionIdValue,
                question: question,
                answer: answer,
                category: categoryValue,
                tag: updatedTags
              })
              .select();
              
            if (insertError) {
              return NextResponse.json(
                { success: false, message: `Error saat menyimpan question: ${insertError.message}` },
                { status: 500 }
              );
            }
            
            questionData = insertedData[0];
          } else {
            // Jika question sudah ada, lakukan update
            const { data: updatedData, error: updateError } = await supabase
              .from('question')
              .update({
                question: question,
                answer: answer,
                category: categoryValue,
                tag: updatedTags
              })
              .eq('id', questionIdValue)
              .select();
              
            if (updateError) {
              return NextResponse.json(
                { success: false, message: `Error saat memperbarui question: ${updateError.message}` },
                { status: 500 }
              );
            }
            
            questionData = updatedData[0];
          }
          
          if (!questionData) {
            return NextResponse.json(
              { success: false, message: "Gagal menyimpan question: Tidak ada data yang dikembalikan" },
              { status: 500 }
            );
          }

      // Simpan FAQ untuk setiap storeId
      const results = [];
      
      for (const targetStoreId of targetStoreIds) {
        const faqId = id || uuidv4();
        
        try {
          const { data: faqData, error: faqError } = await supabase
            .from('faq_documents')
            .upsert({
              id: faqId,
              store_id: targetStoreId,
              question_id: questionIdValue,
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (faqError) {
            results.push({
              id: faqId,
              storeId: targetStoreId,
              success: false,
              error: `Error saat menyimpan faq_document: ${faqError.message}`
            });
            continue;
          }
          
          // Format hasil untuk dikembalikan
          results.push({
            id: faqId,
            storeId: targetStoreId,
            success: true,
            operation: id ? 'updated' : 'created',
            faq: {
              id: faqId,
              store_id: targetStoreId,
              question_id: questionIdValue,
              question: questionData.question,
              answer: questionData.answer,
              category: questionData.category,
              tags: questionData.tag,
              created_at: faqData.created_at,
              updated_at: faqData.updated_at
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
            success: true,
            message: id ? 'FAQ berhasil diperbarui' : 'FAQ berhasil ditambahkan',
            faq: result.faq
          }, { status: id ? 200 : 201 });
        } else {
          return NextResponse.json(
            { success: false, message: result.error },
            { status: 500 }
          );
        }
      }
      
      // Jika ada beberapa toko, kembalikan respons batch
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      return NextResponse.json({
        success: successCount > 0,
        message: `FAQ berhasil diproses untuk ${successCount} toko, gagal untuk ${failureCount} toko`,
        results
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating/updating FAQ:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat membuat/memperbarui FAQ' },
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
    const storeIdsParam = searchParams.get('storeIds');
    
    // Validasi input
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Parameter id diperlukan' },
        { status: 400 }
      );
    }

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
    for (const storeIdValue of storeIds) {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('id', storeIdValue)
        .eq('user_id', request.user.id)
        .single();

      if (storeError) {
        return NextResponse.json(
          { success: false, message: `Anda tidak memiliki akses ke toko dengan ID ${storeIdValue}` },
          { status: 403 }
        );
      }
    }

    // Proses penghapusan untuk setiap toko
    const results = [];
    let questionId = null;
    
    for (const storeIdValue of storeIds) {
      try {
        // Cek apakah FAQ ada dan milik toko yang benar
        const { data: existingFAQ, error: checkError } = await supabase
          .from('faq_documents')
          .select('id, store_id, question_id')
          .eq('id', id)
          .eq('store_id', storeIdValue)
          .single();

        if (checkError) {
          if (checkError.code === 'PGRST116') {
            results.push({
              storeId: storeIdValue,
              success: false,
              message: 'FAQ tidak ditemukan'
            });
            continue;
          }
          results.push({
            storeId: storeIdValue,
            success: false,
            message: checkError.message
          });
          continue;
        }

        // Simpan question_id untuk pengecekan nanti
        questionId = existingFAQ.question_id;

        // Hapus FAQ dari faq_documents
        const { error: deleteError } = await supabase
          .from('faq_documents')
          .delete()
          .eq('id', id)
          .eq('store_id', storeIdValue);

        if (deleteError) {
          results.push({
            storeId: storeIdValue,
            success: false,
            message: deleteError.message
          });
          continue;
        }

        // Update vector store untuk FAQ
        try {
          await updateFAQVectorStore(storeIdValue);
        } catch (error) {
          console.error(`Error updating FAQ vector store for storeId ${storeIdValue}:`, error);
          // Lanjutkan meskipun ada error pada vector store
        }

        results.push({
          storeId: storeIdValue,
          success: true,
          message: 'FAQ berhasil dihapus'
        });
      } catch (error) {
        console.error(`Error deleting FAQ for storeId ${storeIdValue}:`, error);
        results.push({
          storeId: storeIdValue,
          success: false,
          message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus FAQ'
        });
      }
    }
    
    // Jika questionId ditemukan, cek apakah masih digunakan di faq_documents lain
    if (questionId) {
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

export const GET = withAuth(getFAQs);
export const POST = withAuth(createOrUpdateFAQ);
export const DELETE = withAuth(deleteFAQ);
