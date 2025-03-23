import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { 
  getProjectRuns, 
  getRunDetails, 
  getRunsByTag, 
  getRunsByMetadata,
  getRunsStats
} from '@/lib/langchain-monitor';

// GET: Mendapatkan statistik monitoring LangChain
async function getMonitoringStats(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const timeFrame = searchParams.get('timeFrame') as "day" | "week" | "month" || "day";
    
    // Dapatkan statistik runs
    const stats = await getRunsStats(process.env.LANGSMITH_PROJECT, timeFrame);
    
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error getting monitoring stats:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendapatkan statistik monitoring' },
      { status: 500 }
    );
  }
}

// GET: Mendapatkan daftar runs
async function getRuns(request: AuthenticatedRequest) {
  try {
    // Ambil parameter dari query string
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '100') : 100;
    const tag = searchParams.get('tag');
    const metadataKey = searchParams.get('metadataKey');
    const metadataValue = searchParams.get('metadataValue');
    const runId = searchParams.get('runId');
    
    // Jika runId disediakan, dapatkan detail run
    if (runId) {
      const runDetails = await getRunDetails(runId);
      return NextResponse.json({ run: runDetails });
    }
    
    // Jika tag disediakan, dapatkan runs berdasarkan tag
    if (tag) {
      const runs = await getRunsByTag(tag, limit);
      return NextResponse.json({ runs });
    }
    
    // Jika metadataKey dan metadataValue disediakan, dapatkan runs berdasarkan metadata
    if (metadataKey && metadataValue) {
      const runs = await getRunsByMetadata(metadataKey, metadataValue, limit);
      return NextResponse.json({ runs });
    }
    
    // Jika tidak ada parameter khusus, dapatkan semua runs
    const runs = await getProjectRuns(limit);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error('Error getting runs:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendapatkan data runs' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  // Ambil parameter dari query string
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  
  // Arahkan ke handler yang sesuai berdasarkan parameter type
  switch (type) {
    case 'stats':
      return getMonitoringStats(request);
    case 'runs':
      return getRuns(request);
    default:
      return NextResponse.json(
        { error: 'Parameter type tidak valid. Gunakan "stats" atau "runs"' },
        { status: 400 }
      );
  }
});
