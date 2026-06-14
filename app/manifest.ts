import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_DESCRIPTION } from './site-config';

/** PWA web app manifest (served at /manifest.webmanifest), so Ignis installs to a home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · Ignis`,
    short_name: 'Ignis',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050505',
    theme_color: '#050505',
    categories: ['finance', 'utilities', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
