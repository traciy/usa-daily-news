/**
 * Central SEO configuration for USA Daily News.
 * Shared metadata and publisher identity used across the site.
 */

export const SITE_CONFIG = {
  name: 'USA Daily News',
  tagline: 'News · Context · Coverage',
  description:
    'Latest U.S. news, politics, business, technology, culture and sports, with concise, source-attributed coverage and context from USA Daily News.',
  url: 'https://usadailynews.space',
  logo: 'https://usadailynews.space/logo.svg',
  ogImage: 'https://usadailynews.space/og-default.svg',
  twitter: '@usadailynews',
  language: 'en',
  keywords: ['US news', 'USA news', 'American politics', 'business news', 'technology news'],
  sameAs: [
    'https://podcasts.apple.com/us/podcast/usa-news-today/id1559275087',
    'https://open.spotify.com/show/7xkv5QPKpwhHHSg0CNj2Rt',
    'https://pocketcasts.com/podcast/usa-news-today/a87e3900-6b00-0139-342a-0acc26574db2',
    'https://castbox.fm/channel/USA-News-Today-id7345467?country=us',
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
