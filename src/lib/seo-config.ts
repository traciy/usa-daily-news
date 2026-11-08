/**
 * Central SEO configuration for USA Daily News.
 * Shared metadata and publisher identity used across the site.
 */

export const SITE_CONFIG = {
  name: 'USA Daily News',
  tagline: 'News · Context · Coverage',
  description:
    'Original US and international news articles on politics, business, technology, culture, weather and sports, with clear source attribution and context.',
  url: 'https://usadailynews.space',
  logo: 'https://usadailynews.space/logo.svg',
  ogImage: 'https://usadailynews.space/og-default.svg',
  twitter: '@usadailynews',
  language: 'en',
  keywords: ['latest US news', 'US news today', 'breaking news USA', 'US politics news', 'US business news', 'US technology news', 'US culture news', 'football scores', 'weather forecast'],
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
      name: 'How are articles prepared for USA Daily News?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'USA Daily News publishes original articles written specifically for our readers. We develop each article in our own language and structure using available source material, which may include official statements, public records, primary documents, and reporting by other publishers. Digital tools, including AI-assisted tools, may support research and drafting.',
      },
    },
    {
      '@type': 'Question',
      name: 'Are USA Daily News articles original?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Our articles are original in their wording, organization, and presentation. Some stories rely on information first reported by other publishers or institutions; when that happens, we aim to credit and link to the source. Original writing does not mean we personally witnessed every event or independently originated every fact.',
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
