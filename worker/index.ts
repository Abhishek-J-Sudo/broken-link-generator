import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { db } from '@/lib/supabase';
import { runSmartCrawl, runTraditionalCrawlWithErrorHandling } from '@/lib/crawler/index';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 3);

interface CrawlJobData {
  jobId: string;
  crawlType: 'smart' | 'traditional';
  url: string;
  preAnalyzedUrls?: string[];
  settings: Record<string, unknown>;
}

async function processCrawlJob(job: Job<CrawlJobData>): Promise<void> {
  const { jobId, crawlType, url, preAnalyzedUrls, settings } = job.data;

  const dbJob = await db.getJob(jobId);
  if (dbJob.status !== 'queued') {
    console.log(`[worker] Skipping job ${jobId} — status is '${dbJob.status}'`);
    return;
  }

  console.log(`[worker] Starting ${crawlType} crawl for job ${jobId}`);

  if (crawlType === 'smart') {
    await runSmartCrawl(jobId, url, preAnalyzedUrls ?? [], settings);
  } else {
    await runTraditionalCrawlWithErrorHandling(jobId, url, settings);
  }
}

async function main() {
  const connection = getRedisConnection();

  // Reap any jobs that were running when the previous worker died
  const reaped = await db.reapStaleJobs();
  if (reaped.length > 0) {
    console.log(`[worker] Reaped ${reaped.length} stale job(s):`, reaped.map((r: { id: string }) => r.id));
  }

  const worker = new Worker<CrawlJobData>('crawl', processCrawlJob, {
    connection,
    concurrency: CONCURRENCY,
    // BullMQ lock must outlast the longest expected crawl; lock is auto-renewed
    // every lockRenewTime ms while the job is active, so this is just a safety
    // bound in case the process hangs without crashing.
    lockDuration: 10 * 60 * 1000,
    lockRenewTime: 2 * 60 * 1000,
  });

  worker.on('completed', (job) => {
    console.log(`[worker] Job ${job.data.jobId} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.data.jobId} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[worker] Worker error:', err.message);
  });

  console.log(`[worker] Listening on queue 'crawl' — concurrency ${CONCURRENCY}`);

  // Graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, async () => {
      console.log(`[worker] ${sig} received — shutting down`);
      await worker.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('[worker] Fatal startup error:', err);
  process.exit(1);
});
