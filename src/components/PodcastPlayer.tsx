import { useEffect, useRef, useState } from 'react';
import { Radio, Play, Pause } from 'lucide-react';

interface PodcastPlayerProps {
  variant?: 'card' | 'overlay';
}

interface PodcastEpisode {
  title: string;
  audioUrl: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return minutes + ':' + remaining;
}

export function PodcastPlayer({ variant = 'card' }: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadLatestEpisode() {
      try {
        const response = await fetch('/api/podcast/latest');
        if (!response.ok) throw new Error('Podcast is temporarily unavailable.');
        const data = await response.json() as PodcastEpisode;
        if (!data.audioUrl || !data.title) throw new Error('No published podcast episode is available.');
        if (cancelled) return;

        setEpisode(data);
        setError('');
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.load();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the latest episode.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLatestEpisode();
    return () => { cancelled = true; };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !episode) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      setError('');
      await audio.play();
    } catch {
      setError('Playback could not start. Please try again.');
      setIsPlaying(false);
    }
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const compact = variant === 'overlay';

  return (
    <section
      aria-label="USA Daily Podcast player"
      className={compact
        ? 'fixed bottom-5 left-1/2 z-50 w-[min(360px,calc(100vw-7rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-xl'
        : 'w-full overflow-hidden rounded-sm border border-gray-700 bg-gray-950 text-white shadow-sm'}
    >
      <div className={compact ? 'flex h-16 items-center gap-2 px-2.5' : 'flex items-center gap-3 px-4 py-3'}>
        <div className={compact
          ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-700'
          : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-700'}>
          <Radio className="h-5 w-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase leading-none tracking-[0.15em] text-red-400">
            USA Daily Podcast
          </p>
          <p className="mt-1 truncate text-xs font-medium leading-tight text-white" title={episode?.title}>
            {loading ? 'Loading latest episode…' : episode?.title || 'Podcast unavailable'}
          </p>
          {compact && (
            <p className="mt-1 text-[10px] text-gray-400">
              {error || (isPlaying ? formatTime(currentTime) + ' / ' + formatTime(duration) : 'Latest episode')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={togglePlayback}
          disabled={!episode || loading}
          className={compact
            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50'
            : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-700 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50'}
          aria-label={isPlaying ? 'Pause latest podcast episode' : 'Play latest podcast episode'}
          title={isPlaying ? 'Pause' : 'Play latest episode'}
        >
          {isPlaying
            ? <Pause className="h-5 w-5" fill="currentColor" />
            : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
        </button>
      </div>

      <div className={compact ? 'h-1 w-full bg-gray-700' : 'h-1.5 w-full bg-gray-700'}>
        <div className="h-full bg-red-600 transition-[width] duration-200" style={{ width: progress + '%' }} />
      </div>

      {!compact && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-400">
          <span>{error || (isPlaying ? 'Playing latest episode' : 'Ready to play')}</span>
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      )}

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onError={() => {
          setIsPlaying(false);
          setError('The latest episode could not be loaded.');
        }}
      />
    </section>
  );
}
