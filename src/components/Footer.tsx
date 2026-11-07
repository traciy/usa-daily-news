interface FooterProps {
  onHome: () => void;
}

const podcastPlatforms = [
  {
    name: 'Apple Podcasts',
    href: 'https://podcasts.apple.com/us/podcast/usa-news-today/id1559275087',
    logo: 'https://cdn.simpleicons.org/applepodcasts/9933CC',
  },
  {
    name: 'Spotify',
    href: 'https://open.spotify.com/show/7xkv5QPKpwhHHSg0CNj2Rt',
    logo: 'https://cdn.simpleicons.org/spotify/1DB954',
  },
  {
    name: 'Pocket Casts',
    href: 'https://pocketcasts.com/podcast/usa-news-today/a87e3900-6b00-0139-342a-0acc26574db2',
    logo: 'https://cdn.simpleicons.org/pocketcasts/F43E37',
  },
  {
    name: 'Castbox',
    href: 'https://castbox.fm/channel/USA-News-Today-id7345467?country=us',
    logo: 'https://cdn.simpleicons.org/castbox/F55B23',
  },
  {
    name: 'X',
    href: 'https://x.com/Usadailynews_',
    logo: 'https://cdn.simpleicons.org/x/000000',
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

            <nav aria-label="USA Daily News podcast platforms">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Listen to USA Daily News</h2>
              <ul className="flex items-center gap-4">
                {podcastPlatforms.map((platform) => (
                  <li key={platform.name}>
                    <a
                      href={platform.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={platform.name + ' — listen to USA Daily News'}
                      title={platform.name}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-sm transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                    >
                      <img src={platform.logo} alt="" loading="lazy" width="20" height="20" className="h-5 w-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400">&copy; {new Date().getFullYear()} USA Daily News. All rights reserved.</p>
      </div>
    </footer>
  );
}
