import { Queue } from 'bullmq';
import { getRedisConnection } from './connection.js';

let _queue = null;

export function getCrawlQueue() {
  if (_queue) return _queue;
  _queue = new Queue('crawl', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
  return _queue;
}

/**
 * Enqueue a crawl job. The DB row must already exist with status='queued'.
 * Returns the BullMQ Job object.
 */
export async function enqueueCrawl(jobId, crawlType, url, preAnalyzedUrls, settings) {
  const queue = getCrawlQueue();
  return queue.add(
    'crawl',
    { jobId, crawlType, url, preAnalyzedUrls, settings },
    { jobId }
  );
}
