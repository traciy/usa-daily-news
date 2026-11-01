import { Newspaper, CloudSun, Trophy } from 'lucide-react';

interface HeaderProps {
  onHome: () => void;
  onNavigate: (path: string) => void;
}

export function Header({ onHome, onNavigate }: HeaderProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="border-b-2 border-gray-900 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between py-2 text-xs text-gray-500 border-b border-gray-200">
          <span>{today}</span>
          <span className="hidden sm:inline">The American Paper of Record</span>
        </div>
        <button
          onClick={onHome}
          className="w-full py-6 flex flex-col items-center justify-center group"
          aria-label="USA Daily News home"
        >
          <div className="flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-red-700 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
            <span className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-gray-900">
              USA Daily News
            </span>
          </div>
          <p className="mt-1 text-[11px] tracking-[0.3em] uppercase text-gray-500">
            Truth · Clarity · Coverage
          </p>
        </button>

        <nav aria-label="Weather and football pages" className="flex items-center justify-center gap-2 pb-3">
          <button
            onClick={() => onNavigate('/weather')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <CloudSun className="h-4 w-4" aria-hidden="true" />
            Weather
          </button>
          <button
            onClick={() => onNavigate('/football')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Football
          </button>
        </nav>
      </div>
    </header>
  );
}
