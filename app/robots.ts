import type { MetadataRoute } from 'next';
import { SITE_URL } from './site-config';

/** /robots.txt — let crawlers in, but keep the API routes and the dev console out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/console'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
