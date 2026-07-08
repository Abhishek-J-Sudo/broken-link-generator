import IORedis from 'ioredis';

// Persist connection across Next.js hot reloads in development.
const g = globalThis;

function getClient() {
  if (g._rlRedisClient) return g._rlRedisClient;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.error('[rateLimit] Redis error:', err.message);
  });

  g._rlRedisClient = client;
  return client;
}

// Sliding-window check + record with progressive penalty (atomic).
// KEYS: [1] sorted-set, [2] violation hash, [3] sequence counter
// ARGV: [1] now_ms, [2] windowMs, [3] maxRequests, [4] blockDurationMs, [5] maxPenalty
// Returns: [1, remaining, 0]       — allowed
//          [0, blockedUntil_ms, violationCount] — denied
const SLIDING_WINDOW_LUA = `
local now         = tonumber(ARGV[1])
local windowMs    = tonumber(ARGV[2])
local maxReq      = tonumber(ARGV[3])
local blockMs     = tonumber(ARGV[4])
local maxPenalty  = tonumber(ARGV[5])

local blockedUntil = tonumber(redis.call('HGET', KEYS[2], 'blockedUntil')) or 0
if blockedUntil > now then
  local c = tonumber(redis.call('HGET', KEYS[2], 'count')) or 0
  return {0, blockedUntil, c}
end

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
local n = redis.call('ZCARD', KEYS[1])

if n >= maxReq then
  local v = (tonumber(redis.call('HGET', KEYS[2], 'count')) or 0) + 1
  local penalty = math.min(v, maxPenalty)
  local until_ = now + blockMs * penalty
  redis.call('HMSET', KEYS[2], 'count', v, 'blockedUntil', until_)
  redis.call('PEXPIRE', KEYS[2], blockMs * maxPenalty + 60000)
  return {0, until_, v}
end

local seq = redis.call('INCR', KEYS[3])
redis.call('PEXPIRE', KEYS[3], windowMs + 5000)
redis.call('ZADD', KEYS[1], now, tostring(now) .. ':' .. tostring(seq))
redis.call('PEXPIRE', KEYS[1], windowMs + 5000)
return {1, maxReq - n - 1, 0}
`;

// Brute-force counter: increment within window, reset if expired.
// KEYS: [1] hash key
// ARGV: [1] now_ms, [2] lockoutMs
// Returns: [count, resetAt_ms]
const BRUTE_FORCE_LUA = `
local now      = tonumber(ARGV[1])
local lockoutMs = tonumber(ARGV[2])

local data   = redis.call('HMGET', KEYS[1], 'count', 'resetAt')
local count  = tonumber(data[1]) or 0
local resetAt = tonumber(data[2]) or 0

if now >= resetAt then
  count  = 1
  resetAt = now + lockoutMs
else
  count = count + 1
end

redis.call('HMSET', KEYS[1], 'count', count, 'resetAt', resetAt)
redis.call('PEXPIRE', KEYS[1], lockoutMs + 5000)
return {count, resetAt}
`;

/**
 * Atomic sliding-window rate-limit check + record.
 *
 * Succeeds open (allows request) when Redis is unreachable — we do not block
 * legitimate traffic because the rate-limit store is temporarily down.
 */
export async function checkAndRecord(ip, endpoint, limit) {
  const { maxRequests, windowMs, blockDurationMs } = limit;
  const now = Date.now();

  const reqKey  = `rl:req:${endpoint}:${ip}`;
  const violKey = `rl:viol:${endpoint}:${ip}`;
  const cntKey  = `rl:cnt:${endpoint}:${ip}`;

  try {
    const res = await getClient().eval(
      SLIDING_WINDOW_LUA,
      3,
      reqKey, violKey, cntKey,
      String(now),
      String(windowMs),
      String(maxRequests),
      String(blockDurationMs),
      '5',
    );

    const [allowed, value, violationCount] = res;

    if (allowed === 1) {
      const remaining = Number(value);
      return {
        allowed: true,
        remaining,
        resetTime: now + windowMs,
        headers: {
          'X-RateLimit-Limit':      String(maxRequests),
          'X-RateLimit-Remaining':  String(remaining),
          'X-RateLimit-Reset':      String(Math.ceil((now + windowMs) / 1000)),
          'X-RateLimit-Window':     String(Math.ceil(windowMs / 1000)),
        },
      };
    }

    const blockedUntil = Number(value);
    const remainingMs  = Math.max(0, blockedUntil - now);
    return {
      allowed: false,
      retryAfter:     Math.ceil(remainingMs / 1000),
      blockedUntil:   new Date(blockedUntil).toISOString(),
      violationCount: Number(violationCount),
    };
  } catch (err) {
    console.error('[rateLimit] Redis sliding-window failed, allowing request:', err.message);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
      headers: {
        'X-RateLimit-Limit':     String(maxRequests),
        'X-RateLimit-Remaining': String(maxRequests - 1),
        'X-RateLimit-Reset':     String(Math.ceil((now + windowMs) / 1000)),
        'X-RateLimit-Window':    String(Math.ceil(windowMs / 1000)),
      },
    };
  }
}

/** Read current brute-force state. Fails open (not blocked) on Redis error. */
export async function checkBruteForce(ip) {
  try {
    const data = await getClient().hmget(`rl:bf:${ip}`, 'count', 'resetAt');
    return { count: Number(data[0]) || 0, resetAt: Number(data[1]) || 0 };
  } catch (err) {
    console.error('[rateLimit] Redis brute-force check failed:', err.message);
    return { count: 0, resetAt: 0 };
  }
}

/** Record an auth failure (atomic increment-or-reset). */
export async function recordBruteForce(ip, lockoutMs) {
  try {
    const res = await getClient().eval(
      BRUTE_FORCE_LUA,
      1,
      `rl:bf:${ip}`,
      String(Date.now()),
      String(lockoutMs),
    );
    return { count: Number(res[0]), resetAt: Number(res[1]) };
  } catch (err) {
    console.error('[rateLimit] Redis brute-force record failed:', err.message);
    return { count: 0, resetAt: 0 };
  }
}

/** Clear brute-force state on successful auth. */
export async function clearBruteForce(ip) {
  try {
    await getClient().del(`rl:bf:${ip}`);
  } catch (err) {
    console.error('[rateLimit] Redis brute-force clear failed:', err.message);
  }
}
