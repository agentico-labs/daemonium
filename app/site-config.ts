/**
 * Canonical site identity, shared by the metadata in layout.tsx and the generated robots /
 * sitemap / manifest. The base URL is resolved from the deploy environment so Open Graph and
 * sitemap links are absolute and correct in production; set NEXT_PUBLIC_SITE_URL to override
 * (e.g. a custom domain). Vercel's project/production URLs are the automatic fallbacks.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000';

export const SITE_NAME = 'Daemonium';
export const SITE_TITLE = 'Daemonium · Ignis — a living flame that acts onchain';
export const SITE_DESCRIPTION =
  'Summon Ignis — a living flame companion you speak to, that speaks back and acts onchain behind an explicit human confirm gate.';
