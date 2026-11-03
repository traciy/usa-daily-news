import { Radio } from 'lucide-react';

interface PodcastPlayerProps {
  variant?: 'card' | 'overlay';
}

/**
 * Use Spreaker's official hosted player rather than a Supabase RSS proxy.
 * show_id always resolves to the show's latest published episode.
 */
const SPREAKER_PLAYER_URL =
  'https://widget.spreaker.com/player?show_id=7171820&theme=dark&playlist=show&playlist-autoupdate=true';

export function PodcastPlayer({ variant = 'card' }: PodcastPlayerProps) {
  if (variant === 'overlay') {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-2xl">
        <div className="flex items-center gap-2 bg-gray-900 px-3 py-2">
          <Radio className="h-4 w-4 shrink-0 text-red-500" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
            USA Daily Podcast
          </span>
          <a
            href="https://www.spreaker.com/show/7171820"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-300 underline hover:text-white"
          >
            Open show
          </a>
        </div>
        <iframe
          title="USA Daily Podcast — latest episode"
          src={SPREAKER_PLAYER_URL}
          width="100%"
          height="430"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block w-full border-0 bg-gray-950"
        />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm" aria-label="USA Daily Podcast">
      <div className="flex items-center gap-3 bg-gray-900 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-700">
          <Radio className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-serif text-base font-bold text-white">USA Daily Podcast</h2>
          <p className="text-[11px] uppercase tracking-wider text-gray-300">Latest episodes</p>
        </div>
      </div>
      <iframe
        title="USA Daily Podcast — latest episode"
        src={SPREAKER_PLAYER_URL}
        width="100%"
        height="500"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="block w-full border-0 bg-gray-950"
      />
    </section>
  );
}
