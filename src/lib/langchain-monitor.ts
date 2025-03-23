import { Client } from "langsmith";

/**
 * Utilitas untuk monitoring dan debugging aplikasi LangChain
 */

// Fungsi untuk mendapatkan LangSmith client
export const getLangSmithClient = () => {
  return new Client({
    apiUrl: process.env.LANGSMITH_ENDPOINT,
    apiKey: process.env.LANGSMITH_API_KEY,
  });
};

// Fungsi untuk mendapatkan semua runs dari project
export const getProjectRuns = async (
  limit: number = 100,
  projectName: string = process.env.LANGSMITH_PROJECT || "default"
) => {
  try {
    const client = getLangSmithClient();
    const runsIterator = client.listRuns({
      projectName,
      limit,
    });
    
    // Konversi AsyncIterable ke array
    const runs = [];
    for await (const run of runsIterator) {
      runs.push(run);
    }
    
    return runs;
  } catch (error) {
    console.error("Error mendapatkan runs dari LangSmith:", error);
    throw error;
  }
};

// Fungsi untuk mendapatkan detail run berdasarkan run_id
export const getRunDetails = async (runId: string) => {
  try {
    const client = getLangSmithClient();
    const run = await client.readRun(runId);
    return run;
  } catch (error) {
    console.error(`Error mendapatkan detail run ${runId}:`, error);
    throw error;
  }
};

// Fungsi untuk mendapatkan semua runs berdasarkan tag
export const getRunsByTag = async (
  tag: string,
  limit: number = 100,
  projectName: string = process.env.LANGSMITH_PROJECT || "default"
) => {
  try {
    const client = getLangSmithClient();
    const runsIterator = client.listRuns({
      projectName,
      filter: `tags LIKE "%${tag}%"`,
      limit,
    });
    
    // Konversi AsyncIterable ke array
    const runs = [];
    for await (const run of runsIterator) {
      runs.push(run);
    }
    
    return runs;
  } catch (error) {
    console.error(`Error mendapatkan runs dengan tag ${tag}:`, error);
    throw error;
  }
};

// Fungsi untuk mendapatkan semua runs berdasarkan metadata
export const getRunsByMetadata = async (
  key: string,
  value: string,
  limit: number = 100,
  projectName: string = process.env.LANGSMITH_PROJECT || "default"
) => {
  try {
    const client = getLangSmithClient();
    const runsIterator = client.listRuns({
      projectName,
      filter: `metadata.${key} = "${value}"`,
      limit,
    });
    
    // Konversi AsyncIterable ke array
    const runs = [];
    for await (const run of runsIterator) {
      runs.push(run);
    }
    
    return runs;
  } catch (error) {
    console.error(`Error mendapatkan runs dengan metadata ${key}=${value}:`, error);
    throw error;
  }
};

// Fungsi untuk mendapatkan statistik runs
export const getRunsStats = async (
  projectName: string = process.env.LANGSMITH_PROJECT || "default",
  timeFrame: "day" | "week" | "month" = "day"
) => {
  try {
    const client = getLangSmithClient();
    
    // Hitung waktu mulai berdasarkan timeFrame
    const now = new Date();
    let startTime: Date;
    
    switch (timeFrame) {
      case "day":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const startTimeStr = startTime.toISOString();
    
    // Dapatkan semua runs dalam timeFrame
    const runsIterator = client.listRuns({
      projectName,
      filter: `start_time > "${startTimeStr}"`,
    });
    
    // Konversi AsyncIterable ke array
    const runs = [];
    for await (const run of runsIterator) {
      runs.push(run);
    }
    
    // Hitung statistik
    const totalRuns = runs.length;
    const successfulRuns = runs.filter(run => run.status === "success").length;
    const errorRuns = runs.filter(run => run.status === "error").length;
    const averageRuntime = runs.length > 0 
      ? runs.reduce((sum, run) => {
          if (run.end_time && run.start_time) {
            const endTime = new Date(run.end_time).getTime();
            const startTime = new Date(run.start_time).getTime();
            return sum + (endTime - startTime);
          }
          return sum;
        }, 0) / runs.length / 1000
      : 0;
    
    // Hitung distribusi run berdasarkan tag
    const tagDistribution: Record<string, number> = {};
    runs.forEach(run => {
      if (run.tags && run.tags.length > 0) {
        run.tags.forEach(tag => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      }
    });
    
    return {
      totalRuns,
      successfulRuns,
      errorRuns,
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      averageRuntime,
      tagDistribution,
      timeFrame,
    };
  } catch (error) {
    console.error(`Error mendapatkan statistik runs:`, error);
    throw error;
  }
};

// Fungsi untuk mendapatkan feedback dari runs
export const getRunsFeedback = async (
  limit: number = 100,
  projectName: string = process.env.LANGSMITH_PROJECT || "default"
) => {
  try {
    const client = getLangSmithClient();
    const runsIterator = client.listRuns({
      projectName,
      filter: `has_feedback = true`,
      limit,
    });
    
    // Konversi AsyncIterable ke array
    const runs = [];
    for await (const run of runsIterator) {
      runs.push(run);
    }
    
    const runsWithFeedback = [];
    
    for (const run of runs) {
      const feedbackIterator = client.listFeedback({
        runIds: [run.id],
      });
      
      // Konversi AsyncIterable ke array
      const feedback = [];
      for await (const item of feedbackIterator) {
        feedback.push(item);
      }
      
      runsWithFeedback.push({
        run,
        feedback,
      });
    }
    
    return runsWithFeedback;
  } catch (error) {
    console.error(`Error mendapatkan feedback runs:`, error);
    throw error;
  }
};
