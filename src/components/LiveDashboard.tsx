import { WeatherWidget } from '@/components/WeatherWidget';
import { FootballLiveScores } from '@/components/FootballLiveScores';

/**
 * Horizontal dashboard row containing the weather and football widgets.
 * Positioned directly beneath the main navigation and above page content.
 * The two widgets operate independently — a failure in one never affects
 * the other.
 */
export function LiveDashboard() {
  return (
    <div
      className="bg-gray-50 border-b border-gray-200"
      aria-label="Live information dashboard"
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Weather — compact on desktop */}
          <div className="sm:col-span-1">
            <WeatherWidget />
          </div>

          {/* Football — wider on desktop */}
          <div className="sm:col-span-2">
            <FootballLiveScores />
          </div>
        </div>
      </div>
    </div>
  );
}
