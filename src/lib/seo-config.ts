/**
 * Central SEO configuration for USA Daily News.
 * All per-page metadata hooks read from this so titles, descriptions,
 * social profiles, and structured data stay consistent across the site.
 */

export const SITE_CONFIG = {
  name: 'USA Daily News',
  tagline: 'Truth · Clarity · Coverage',
  description:
    'Independent American journalism covering Politics, Tech, Economy, and Culture. Fresh stories every day with clarity and coverage you can trust.',
  url: 'https://usadailynews.space',
  logo: 'https://usadailynews.space/logo.png',
  ogImage: 'https://usadailynews.space/og-default.png',
  twitter: '@usadailynews',
  language: 'en',
  // Primary target keywords — used in meta keywords and structured data.
  keywords: ['US news', 'American politics', 'tech news', 'economy'],
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

/** Organization JSON-LD schema — describes the publisher to search engines and LLMs. */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  logo: {
    '@type': 'ImageObject',
    url: SITE_CONFIG.logo,
  },
  description: SITE_CONFIG.description,
  sameAs: SITE_CONFIG.sameAs,
  publisher: {
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    logo: {
      '@type': 'ImageObject',
      url: SITE_CONFIG.logo,
    },
  },
} as const;

/** Website JSON-LD schema — describes the site and search action. */
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  inLanguage: SITE_CONFIG.language,
  publisher: {
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    logo: {
      '@type': 'ImageObject',
      url: SITE_CONFIG.logo,
    },
  },
} as const;

/** FAQPage JSON-LD schema — surfaces in rich results / AI Overview snippets. */
export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is USA Daily News?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'USA Daily News is an independent American news outlet covering Politics, Technology, Economy, and Culture. We publish fresh, verified stories every day with a focus on clarity, accuracy, and coverage you can trust.',
      },
    },
    {
      '@type': 'Question',
      name: 'What topics does USA Daily News cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We cover four core sections: Politics (policy, elections, government), Tech (innovation, AI, industry), Economy (markets, jobs, fiscal policy), and Culture (arts, society, lifestyle). Each section is updated daily with original reporting.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often is USA Daily News updated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'New stories are published every day across all sections. Our editorial team monitors developing stories in real time, so readers always have the latest reporting on American politics, technology, the economy, and culture.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is USA Daily News independent journalism?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. USA Daily News is fully independent. We are not owned by a political party, corporation, or foreign entity. Our reporting is guided by facts, sourced verification, and a commitment to plain-language truth for every reader.',
      },
    },
  ],
} as const;
