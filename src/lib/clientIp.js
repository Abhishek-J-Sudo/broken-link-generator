// Set TRUST_PROXY=true in Coolify (behind Traefik). Leave unset locally.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

export function getClientIp(request) {
  if (TRUST_PROXY) {
    const xff = request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
