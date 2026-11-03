import { useState } from 'react';
import { Radio, Play, X } from 'lucide-react';

interface PodcastPlayerProps {
  variant?: 'card' | 'overlay';
}

const SPREAKER_PLAYER_URL =
  'https://widget.spreaker.com/player?show_id=7171820&theme=dark&playlist=false';

export function PodcastPlayer({ variant = 'card' }: PodcastPlayerProps) {
  const [expanded, setExpanded] = useState(false);

  if (variant === 'overlay') {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
        {expanded && (
          <div className="w-[min(320px,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-2xl">
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-2">
              <Radio className="h-4 w-4 shrink-0 text-red-500" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                USA Daily Podcast
              </span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded p-1 text-gray-300 hover:bg-gray-700 hover:text-white"
                aria-label="Close podcast player"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              title="USA Daily Podcast — latest episode"
              src={SPREAKER_PLAYER_URL}
              width="100%"
              height="200"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="eager"
              className="block w-full border-0 bg-gray-950"
            />
          </div>
        )}

        <div className="flex h-14 sm:h-16 max-w-[calc(100vw-2.5rem)] items-center gap-2 overflow-hidden rounded-xl border border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800 py-1.5 pl-2 pr-2 shadow-xl sm:pr-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-700 sm:h-11 sm:w-11">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase leading-none tracking-[0.15em] text-red-400">
              USA Daily Podcast
            </p>
            <p className="mt-1 truncate text-xs font-medium leading-tight text-white sm:text-sm">
              {expanded ? 'Player open' : 'Latest episode'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 transition hover:bg-gray-200 sm:h-11 sm:w-11"
            aria-label={expanded ? 'Close podcast player' : 'Open podcast player'}
          >
            {expanded ? <X className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
          </button>
        </div>
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
          <p className="text-[11px] uppercase tracking-wider text-gray-300">Latest episode</p>
        </div>
      </div>
      <iframe
        title="USA Daily Podcast — latest episode"
        src={SPREAKER_PLAYER_URL}
        width="100%"
        height="200"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="block w-full border-0 bg-gray-950"
      />
    </section>
  );
}
