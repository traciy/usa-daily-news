import { useEffect, useState } from 'react';
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
  LocateFixed, AlertCircle, Loader2,
} from 'lucide-react';
import {
  fetchWeather, weatherIconName, weatherLabel,
  type WeatherData, type WeatherResult,
} from '@/lib/weatherService';

const ICONS: Record<string, typeof Sun> = {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
};

const REFRESH_MS = 12 * 60 * 1000; // ~12 minutes

type State =
  | { status: 'loading' }
  | { status: 'success'; data: WeatherData }
  | { status: 'error'; message: string };

export function WeatherWidget() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result: WeatherResult = await fetchWeather();
      if (cancelled) return;
      if (result.error) {
        setState({ status: 'error', message: result.error.message });
      } else if (result.data) {
        setState({ status: 'success', data: result.data });
      }
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <section
      aria-labelledby="weather-widget-title"
      className="bg-white rounded-sm border border-gray-200 shadow-sm p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <LocateFixed className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        <h2 id="weather-widget-title" className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">
          Local Weather
        </h2>
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center gap-3 py-4" aria-label="Loading weather">
          <Loader2 className={`h-5 w-5 text-gray-400 ${reduceMotion ? '' : 'animate-spin'}`} aria-hidden="true" />
          <span className="text-sm text-gray-500">Detecting your location…</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-2 py-2" role="status">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-gray-600 leading-snug">{state.message}</p>
        </div>
      )}

      {state.status === 'success' && (
        <div className="flex items-center gap-4">
          {(() => {
            const IconName = weatherIconName(state.data.weatherCode);
            const Icon = ICONS[IconName] ?? Cloud;
            return (
              <Icon
                className="h-10 w-10 text-gray-700 shrink-0"
                aria-hidden="true"
              />
            );
          })()}
          <div className="min-w-0">
            <p className="text-3xl font-serif font-bold text-gray-900 leading-none">
              {state.data.temperature}°C
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {weatherLabel(state.data.weatherCode)}
            </p>
            <p className="text-xs text-gray-400 mt-1 truncate" title={state.data.locationName}>
              {state.data.locationName}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
