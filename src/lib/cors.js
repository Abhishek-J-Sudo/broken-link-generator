const origin =
  process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'https://yourdomain.com'
    : '*';

export const corsOrigin = origin;
