/**
 * Central SEO configuration for USA Daily News.
 * Shared metadata and publisher identity used across the site.
 */

export const SITE_CONFIG = {
  name: 'USA Daily News',
  tagline: 'News · Context · Coverage',
  description:
    'Digital news coverage and source-attributed summaries across US and international affairs, politics, business, technology, culture, weather and sports.',
  url: 'https://usadailynews.space',
  logo: 'https://usadailynews.space/logo.svg',
  ogImage: 'https://usadailynews.space/og-default.svg',
  twitter: '@usadailynews',
  language: 'en',
  keywords: ['US news', 'USA news', 'American politics', 'business news', 'technology news'],
  sameAs: [
    'https://twitter.com/usadailynews',
    'https://www.facebook.com/usadailynews',
    'https://www.youtube.com/@usadailynews',
    'https://www.linkedin.com/company/usadailynews',
  ],
} as const;

export const NAV_SECTIONS = [
  { label: 'All', path: '#/' },
  { label: 'Politics', path: '#/category/politics' },
  { label: 'Tech', path: '#/category/tech' },
  { label: 'Economy', path: '#/category/economy' },
  { label: 'Culture', path: '#/category/culture' },
] as const;

export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  logo: { '@type': 'ImageObject', url: SITE_CONFIG.logo },
  description: SITE_CONFIG.description,
  sameAs: SITE_CONFIG.sameAs,
} as const;

export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  inLanguage: SITE_CONFIG.language,
  publisher: {
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    logo: { '@type': 'ImageObject', url: SITE_CONFIG.logo },
  },
} as const;

export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How is content prepared for USA Daily News?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Digital tools and AI-assisted processes may help discover, organize and prepare news summaries. Articles may summarize reporting published by other outlets, with source links provided when available.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is every article original reporting?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Some articles summarize or discuss reporting published by other outlets. USA Daily News aims to identify and link to source material when available.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I report an error?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Email contact@usadailynews.space with the article URL, the detail you believe is incorrect and reliable supporting information.',
      },
    },
  ],
} as const;
