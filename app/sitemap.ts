import type { MetadataRoute } from 'next';
import { SITE_URL } from './site-config';

/** /sitemap.xml — only the public landing page (the console is a dev panel, kept out). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
