'use client';

let cachedToken = null;

export async function getCsrfToken() {
  if (cachedToken) return cachedToken;
  const res = await fetch('/api/csrf-token');
  const { csrfToken } = await res.json();
  cachedToken = csrfToken;
  return csrfToken;
}

export function clearCsrfToken() {
  cachedToken = null;
}
