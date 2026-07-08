import IORedis from 'ioredis';

let _conn = null;

export function getRedisConnection() {
  if (_conn) return _conn;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  _conn = new IORedis(url, {
    // BullMQ requires this to be null so it can manage its own retry strategy
    maxRetriesPerRequest: null,
  });

  _conn.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  return _conn;
}
