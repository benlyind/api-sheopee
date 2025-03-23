import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import neo4j, { Driver } from "neo4j-driver";

interface Product {
  use_ai: boolean;
  last_session_update: number | null;
}

// GET: Mengecek status use_ai berdasarkan product_id dan last update dari session
async function checkProductAi(request: AuthenticatedRequest) {
  let driver: Driver | null = null;
  
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('product_id');
    const sessionId = searchParams.get('session_id');

    console.log(`Checking AI status for product_id: ${productId || 'undefined'}, session_id: ${sessionId || 'undefined'}`);

    // Validasi input
    if (!productId || productId.trim() === '') {
      console.log('Missing or empty product_id parameter');
      return NextResponse.json({ 
        use_ai: false,
        last_session_update: null 
      });
    }

    // Ambil data use_ai langsung dari tabel products
    const { data, error: productError } = await supabase
      .from('products')
      .select('use_ai')
      .eq('product_id', productId)
      .maybeSingle();

    if (productError) {
      console.error('Error fetching product:', productError);
      return NextResponse.json(
        { error: productError.message },
        { status: 500 }
      );
    }

    // Jika data tidak ditemukan, kembalikan use_ai: false
    if (!data) {
      console.log('Product not found');
      return NextResponse.json({ 
        use_ai: false,
        last_session_update: null 
      });
    }

    // Inisialisasi response
    const response: Product = {
      use_ai: data.use_ai || false,
      last_session_update: null
    };

    // Jika use_ai true dan sessionId ada, cari last update dari Neo4j
    if (data.use_ai && sessionId) {
      try {
        // Inisialisasi koneksi Neo4j
        driver = neo4j.driver(
          process.env.NEO4J_URI || "neo4j://localhost:7687",
          neo4j.auth.basic(
            process.env.NEO4J_USER || "neo4j",
            process.env.NEO4J_PASSWORD || "password"
          )
        );

        const session = driver.session();

        // Query untuk mendapatkan timestamp pesan terakhir berdasarkan sessionId saja
        const result = await session.run(
          `
          MATCH (c:Conversation {sessionId: $sessionId})-[:HAS_MESSAGE]->(m:Message)
          WITH m.timestamp as lastUpdate
          WHERE lastUpdate IS NOT NULL
          RETURN lastUpdate
          ORDER BY lastUpdate DESC
          LIMIT 1
          `,
          { sessionId }
        );

        await session.close();

        // Jika ada hasil, ambil timestamp dalam format integer
        if (result.records.length > 0) {
          const lastUpdate = result.records[0].get('lastUpdate');
          if (neo4j.isInt(lastUpdate)) {
            // Jika timestamp dalam format Neo4j Integer
            response.last_session_update = lastUpdate.toNumber();
          } else if (typeof lastUpdate === 'number') {
            // Jika timestamp sudah dalam format number
            response.last_session_update = lastUpdate;
          } else if (lastUpdate instanceof Date || typeof lastUpdate === 'string') {
            // Jika timestamp dalam format Date atau string
            const date = new Date(lastUpdate);
            response.last_session_update = date.getTime();
          }
          
          console.log('Found last update:', response.last_session_update);
        } else {
          console.log('No messages found for session:', sessionId);
        }
      } catch (neoError) {
        console.error('Error fetching last session update:', neoError);
        // Tetap null jika terjadi error
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking product AI status:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengecek status AI produk' },
      { status: 500 }
    );
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

export const GET = withAuth(checkProductAi);
