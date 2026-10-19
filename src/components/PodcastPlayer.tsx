import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Radio, Loader2, ChevronRight, Volume2, ListMusic, X } from 'lucide-react';

interface Episode {
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  pubDate: string;
  image: string | null;
  link: string | null;
}

interface FeedResponse {
  title?: string;
  episodes?: Episode[];
  error?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface PodcastPlayerProps {
  variant?: 'card' | 'overlay';
}

export function PodcastPlayer({ variant = 'card' }: PodcastPlayerProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState('USA Daily Podcast');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showList, setShowList] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/podcast-feed`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FeedResponse = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        if (!data.episodes || data.episodes.length === 0) {
          throw new Error('No episodes found in feed.');
        }
        if (data.title) setShowTitle(data.title);
        setEpisodes(data.episodes);
        setCurrentIdx(0);
        setDuration(data.episodes[0].duration || 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load podcast feed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = episodes[currentIdx] ?? null;

  const selectEpisode = (idx: number) => {
    setCurrentIdx(idx);
    setCurrentTime(0);
    setDuration(episodes[idx].duration || 0);
    setIsPlaying(false);
    requestAnimationFrame(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.load();
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    });
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  };

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration || current?.duration || 0);
  };

  const onEnded = () => {
    setIsPlaying(false);
    if (currentIdx < episodes.length - 1) {
      selectEpisode(currentIdx + 1);
    }
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const audioEl = current && (
    <audio
      ref={audioRef}
      src={current.audioUrl}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={onEnded}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      preload="metadata"
      crossOrigin="anonymous"
    />
  );

  const episodeList = (
    <div className="max-h-64 overflow-y-auto">
      <ul>
        {episodes.map((ep, idx) => (
          <li key={`${ep.audioUrl}-${idx}`}>
            <button
              onClick={() => {
                selectEpisode(idx);
                setShowList(false);
              }}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                idx === currentIdx ? 'bg-red-50/50' : ''
              }`}
            >
              <span
                className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-full text-[10px] font-bold ${
                  idx === currentIdx ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {idx === currentIdx && isPlaying ? (
                  <Pause className="h-3 w-3" fill="currentColor" />
                ) : (
                  <Play className="h-3 w-3 ml-0.5" fill="currentColor" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-medium leading-snug line-clamp-1 ${
                    idx === currentIdx ? 'text-red-800' : 'text-gray-800'
                  }`}
                >
                  {ep.title}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {timeAgo(ep.pubDate)} · {formatDuration(ep.duration)}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  // ---- Overlay variant: small floating square, expands on click ----
  if (variant === 'overlay') {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
        {/* Expanded panel */}
        {expanded && (
          <div className="w-72 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-3 overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-red-600 blur-2xl" />
              </div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping" style={{ animationDuration: '3s' }} />
                    <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-red-700">
                      <Radio className="h-4 w-4 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold text-white text-sm leading-tight truncate">
                      {showTitle}
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className="inline-block w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                      Live Podcast
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-gray-400 hover:text-white transition-colors shrink-0"
                  aria-label="Close player"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading episodes…</span>
              </div>
            )}

            {error && !loading && (
              <div className="py-6 px-4 text-center">
                <p className="text-xs text-red-700 font-medium">Couldn't load the podcast.</p>
                <p className="text-[10px] text-gray-500 mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && current && (
              <>
                {/* Now playing */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded bg-gray-100">
                      {current.image ? (
                        <img src={current.image} alt={current.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <Radio className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      {isPlaying && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 bg-white animate-pulse" style={{ height: '60%', animationDuration: '0.4s' }} />
                            <span className="w-0.5 bg-white animate-pulse" style={{ height: '100%', animationDuration: '0.6s' }} />
                            <span className="w-0.5 bg-white animate-pulse" style={{ height: '40%', animationDuration: '0.5s' }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] uppercase tracking-wider text-red-700 font-semibold">Now Playing</p>
                      <h4 className="font-serif font-bold text-xs text-gray-900 leading-snug line-clamp-2 mt-0.5">
                        {current.title}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {timeAgo(current.pubDate)} · {formatDuration(duration)}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      value={currentTime}
                      onChange={seek}
                      className="w-full h-1 appearance-none rounded-full cursor-pointer accent-red-700"
                      style={{
                        background: `linear-gradient(to right, #b91c1c ${progress}%, #e5e7eb ${progress}%)`,
                      }}
                      aria-label="Seek"
                    />
                    <div className="flex justify-between text-[9px] text-gray-500 mt-0.5 tabular-nums">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <button
                      onClick={(e) => togglePlay(e)}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-red-700 hover:bg-red-800 active:scale-95 transition-all shrink-0"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 text-white" fill="white" />
                      ) : (
                        <Play className="h-4 w-4 text-white ml-0.5" fill="white" />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Volume2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={onVolume}
                        className="w-16 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-gray-700"
                        aria-label="Volume"
                      />
                    </div>

                    <button
                      onClick={() => setShowList((s) => !s)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0 ${
                        showList ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      aria-label="Toggle episode list"
                    >
                      <ListMusic className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {showList ? (
                  episodeList
                ) : (
                  current.link && (
                    <a
                      href={current.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 py-2 text-[11px] text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Open episode page <ChevronRight className="h-3 w-3" />
                    </a>
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* Floating mini player — always visible, shows episode + play button */}
        {loading ? (
          <div className="flex items-center gap-2.5 h-14 px-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-xl border border-gray-700">
            <Loader2 className="h-5 w-5 text-white animate-spin shrink-0" />
            <span className="text-xs text-gray-300 truncate">Loading podcast…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2.5 h-14 px-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-xl border border-gray-700">
            <Radio className="h-5 w-5 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400 truncate">Podcast unavailable</span>
          </div>
        ) : !expanded ? (
          <div className="flex items-center gap-2 h-14 sm:h-16 pl-2 pr-2 sm:pr-3 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-xl border border-gray-700 overflow-hidden max-w-[calc(100vw-2.5rem)] sm:max-w-sm">
            {/* Live indicator */}
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg bg-red-700">
              <span className="absolute inset-0 rounded-lg bg-red-600/40 animate-ping" style={{ animationDuration: '2.5s' }} />
              <Radio className="relative h-5 w-5 text-white" strokeWidth={2} />
            </div>

            {/* Episode title — visible on all screens */}
            <button
              onClick={() => setExpanded(true)}
              className="min-w-0 flex-1 text-left"
              aria-label="Open full player"
            >
              <p className="text-[9px] uppercase tracking-[0.15em] text-red-400 font-bold leading-none flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                {isPlaying ? 'Now Playing' : 'Latest Episode'}
              </p>
              <p className="text-xs sm:text-sm font-medium text-white truncate leading-tight mt-1">
                {current?.title ?? 'Tap to browse episodes'}
              </p>
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-2.5 mt-1">
                  <span className="w-0.5 bg-red-500 animate-pulse" style={{ height: '50%', animationDuration: '0.4s' }} />
                  <span className="w-0.5 bg-red-500 animate-pulse" style={{ height: '100%', animationDuration: '0.6s' }} />
                  <span className="w-0.5 bg-red-500 animate-pulse" style={{ height: '30%', animationDuration: '0.5s' }} />
                  <span className="w-0.5 bg-red-500 animate-pulse" style={{ height: '75%', animationDuration: '0.45s' }} />
                </div>
              )}
            </button>

            {/* Play/pause button */}
            <button
              onClick={(e) => togglePlay(e)}
              className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white hover:bg-gray-100 active:scale-95 transition-all shrink-0"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-gray-900" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5 text-gray-900 ml-0.5" fill="currentColor" />
              )}
            </button>

            {/* Expand button — opens episode list */}
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 transition-all shrink-0"
              aria-label="Open episode list"
            >
              <ListMusic className="h-4 w-4 text-white" />
            </button>
          </div>
        ) : (
          /* When expanded, just show a close button (panel is above) */
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-xl hover:scale-105 active:scale-95 transition-all border border-gray-700"
            aria-label="Close podcast player"
          >
            <X className="relative h-6 w-6 text-white" />
          </button>
        )}

        {/* Audio element — kept outside conditional branches so playback persists */}
        {current && audioEl}
      </div>
    );
  }

  // ---- Card variant: full sidebar card ----
  return (
    <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-5 py-4 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-red-600 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-blue-600 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-red-700">
              <Radio className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-serif font-bold text-white text-base leading-tight truncate">
              {showTitle}
            </h3>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mt-0.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live Podcast Player
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading latest episodes…</span>
        </div>
      )}

      {error && !loading && (
        <div className="py-8 px-5 text-center">
          <p className="text-sm text-red-700 font-medium">Couldn't load the podcast feed.</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && current && (
        <>
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex gap-3">
              <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-sm bg-gray-100">
                {current.image ? (
                  <img src={current.image} alt={current.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <Radio className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-4">
                      <span className="w-0.5 bg-white animate-pulse" style={{ height: '60%', animationDuration: '0.4s' }} />
                      <span className="w-0.5 bg-white animate-pulse" style={{ height: '100%', animationDuration: '0.6s' }} />
                      <span className="w-0.5 bg-white animate-pulse" style={{ height: '40%', animationDuration: '0.5s' }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-red-700 font-semibold">Now Playing</p>
                <h4 className="font-serif font-bold text-sm text-gray-900 leading-snug line-clamp-2 mt-0.5">
                  {current.title}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {timeAgo(current.pubDate)} · {formatDuration(duration)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={seek}
                className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-red-700"
                style={{
                  background: `linear-gradient(to right, #b91c1c ${progress}%, #e5e7eb ${progress}%)`,
                }}
                aria-label="Seek"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={(e) => togglePlay(e)}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-red-700 hover:bg-red-800 active:scale-95 transition-all"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-white" fill="white" />
                ) : (
                  <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                )}
              </button>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Volume2 className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={onVolume}
                  className="w-20 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-gray-700"
                  aria-label="Volume"
                />
              </div>

              {current.link && (
                <a
                  href={current.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="Open episode page"
                >
                  <ChevronRight className="h-5 w-5" />
                </a>
              )}
            </div>

            {audioEl}
          </div>

          <div className="max-h-72 overflow-y-auto">
            <p className="px-5 pt-3 pb-1 text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">
              Latest Episodes
            </p>
            <ul>
              {episodes.map((ep, idx) => (
                <li key={`${ep.audioUrl}-${idx}`}>
                  <button
                    onClick={() => selectEpisode(idx)}
                    className={`w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-t border-gray-100 ${
                      idx === currentIdx ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex items-center justify-center w-7 h-7 shrink-0 rounded-full text-[10px] font-bold ${
                        idx === currentIdx
                          ? 'bg-red-700 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {idx === currentIdx && isPlaying ? (
                        <Pause className="h-3 w-3" fill="currentColor" />
                      ) : (
                        <Play className="h-3 w-3 ml-0.5" fill="currentColor" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium leading-snug line-clamp-2 ${
                          idx === currentIdx ? 'text-red-800' : 'text-gray-800'
                        }`}
                      >
                        {ep.title}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {timeAgo(ep.pubDate)} · {formatDuration(ep.duration)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
