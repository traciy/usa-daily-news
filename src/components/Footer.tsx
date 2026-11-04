import { SITE_CONFIG } from '@/lib/seo-config';

interface FooterProps {
  onHome: () => void;
}

const podcastPlatforms = [
  {
    name: 'Apple Podcasts',
    href: 'https://podcasts.apple.com/us/podcast/usa-news-today/id1559275087',
    logo: 'https://cdn.simpleicons.org/applepodcasts/9933CC',
    description: 'Listen on Apple Podcasts',
  },
  {
    name: 'Spotify',
    href: 'https://open.spotify.com/show/7xkv5QPKpwhHHSg0CNj2Rt',
    logo: 'https://cdn.simpleicons.org/spotify/1DB954',
    description: 'Listen on Spotify',
  },
  {
    name: 'Pocket Casts',
    href: 'https://pocketcasts.com/podcast/usa-news-today/a87e3900-6b00-0139-342a-0acc26574db2',
    logo: 'https://cdn.simpleicons.org/pocketcasts/F43E37',
    description: 'Listen on Pocket Casts',
  },
  {
    name: 'Castbox',
    href: 'https://castbox.fm/channel/USA-News-Today-id7345467?country=us',
    logo: 'https://cdn.simpleicons.org/castbox/F55B23',
    description: 'Listen on Castbox',
  },
];

export function Footer({ onHome }: FooterProps) {
  return (
    <footer className="mt-16 border-t-2 border-gray-900 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          <div>
            <button onClick={onHome} className="text-left" aria-label="USA Daily News home">
              <span className="text-xl font-serif font-bold text-gray-900">USA Daily News</span>
              <p className="text-xs text-gray-500 mt-1">News, context and developing stories.</p>
            </button>
            <p className="mt-4 text-sm text-gray-600 max-w-xs leading-relaxed">
              Coverage of news, politics, technology, the economy, culture, weather and sports.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <nav aria-label="Site information">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Information</h2>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 max-w-xl">
                <li><a href="/about" className="text-sm text-gray-700 hover:text-red-700 underline underline-offset-4">About</a></li>
                <li><a href="/contact" className="text-sm text-gray-700 hover:text-red-700 underline underline-offset-4">Contact</a></li>
                <li><a href="/editorial-policy" className="text-sm text-gray-700 hover:text-red-700 underline underline-offset-4">Editorial policy</a></li>
                <li><a href="/corrections" className="text-sm text-gray-700 hover:text-red-700 underline underline-offset-4">Corrections</a></li>
                <li><a href="/privacy-policy" className="text-sm text-gray-700 hover:text-red-700 underline underline-offset-4">Privacy</a></li>
              </ul>
            </nav>
          </div>
        </div>

        <section className="mt-9 border-t border-gray-200 pt-7" aria-labelledby="footer-podcast-heading">
          <div className="mb-5">
            <h2 id="footer-podcast-heading" className="text-sm font-bold uppercase tracking-[0.18em] text-gray-800">Listen to USA News Today</h2>
            <p className="mt-1 text-sm text-gray-600">Follow the podcast on your preferred platform.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {podcastPlatforms.map((platform) => (
              <li key={platform.name}>
                <a
                  href={platform.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={platform.description}
                  className="flex min-h-[76px] items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <img src={platform.logo} alt="" loading="lazy" width="32" height="32" className="h-8 w-8 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{platform.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8 text-xs text-gray-400">&copy; {new Date().getFullYear()} USA Daily News. All rights reserved.</p>
      </div>
    </footer>
  );
}
