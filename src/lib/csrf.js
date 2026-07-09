import { createCsrfProtect, CsrfError } from '@edge-csrf/nextjs';

export { CsrfError };

export const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  },
  secret: process.env.CSRF_SECRET || 'dev-only-not-for-production',
});
