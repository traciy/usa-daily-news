import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
  Droplets, Wind, Compass, Gauge, Search, Loader2, AlertCircle, ArrowLeft,
  Sunrise, Sunset, Clock, MapPin,
} from 'lucide-react';
import {
  fetchFullWeather, searchCities, getInitialCoords, saveLocation,
  weatherIconName, weatherLabel, windDirectionLabel,
  type FullWeatherData, type CitySearchResult, type SavedLocation,
} from '@/lib/weatherService';
import { useSeo } from '@/lib/seo';
import { SITE_CONFIG, ORGANIZATION_SCHEMA, WEBSITE_SCHEMA } from '@/lib/seo-config';

const ICONS: Record<string, typeof Sun> = {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
};

const REFRESH_MS = 12 * 60 * 1000;
const WEATHER_REFRESH_LABEL = '12 minutes';

interface WeatherPageProps {
  onBack: () => void;
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const IconName = weatherIconName(code);
  const Icon = ICONS[IconName] ?? Cloud;
  return <Icon className={className} aria-hidden="true" />;
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function WeatherPage({ onBack }: WeatherPageProps) {
  const [weather, setWeather] = useState<FullWeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('Nairobi');
  const [coords, setCoords] = useState({ lat: -1.2864, lon: 36.8172 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (lat: number, lon: number, name: string) => {
    setLoading(true);
    setError(null);
    const result = await fetchFullWeather(lat, lon, name);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setWeather(result.data);
      setLocationName(name);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { coords: initialCoords, name } = await getInitialCoords();
      if (cancelled) return;
      setCoords(initialCoords);
      await load(initialCoords.lat, initialCoords.lon, name);
    })();
    return () => { cancelled = true; };
  }, [load]);

  // Auto-refresh every ~12 minutes.
  useEffect(() => {
    const interval = setInterval(() => {
      load(coords.lat, coords.lon, locationName);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [coords, locationName, load]);

  // Debounced city search.
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchCities(searchQuery);
      setSearchResults(results);
      setShowResults(true);
      setSearching(false);
    }, 350);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const selectCity = (city: CitySearchResult) => {
    const saved: SavedLocation = {
      name: city.name,
      lat: city.latitude,
      lon: city.longitude,
      country: city.country,
    };
    saveLocation(saved);
    setCoords({ lat: city.latitude, lon: city.longitude });
    setSearchQuery('');
    setShowResults(false);
    load(city.latitude, city.longitude, city.name);
  };

  // Stable SEO metadata — does not change on every data refresh.
  const seoTitle = `Live Weather Forecast Today | Current Conditions & 7-Day Forecast`;
  const seoDescription = `Check current weather conditions, live temperatures, hourly forecasts and the 7-day weather forecast for ${locationName}. Get the latest weather updates.`;
  const canonicalUrl = `${SITE_CONFIG.url}/#/weather`;

  const jsonLd = useMemo(() => ([
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seoTitle,
      url: canonicalUrl,
      description: seoDescription,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: SITE_CONFIG.name, url: SITE_CONFIG.url },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_CONFIG.url },
          { '@type': 'ListItem', position: 2, name: 'Weather', item: canonicalUrl },
        ],
      },
    },
  ]), [seoTitle, seoDescription, canonicalUrl]);

  useSeo({
    title: seoTitle,
    description: seoDescription,
    type: 'website',
    url: canonicalUrl,
    jsonLd,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to homepage
      </button>

      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 mb-2">
        Live Weather Forecast
      </h1>
      <p className="text-gray-600 mb-6">
        Current conditions, hourly outlook, and a 7-day forecast for your area. Updated every {WEATHER_REFRESH_LABEL}.
      </p>

      {/* City search */}
      <div className="relative mb-8 max-w-md">
        <label htmlFor="city-search" className="sr-only">Search for a city</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
          <input
            id="city-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a city…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            aria-label="Search for a city"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" aria-hidden="true" />
          )}
        </div>
        {showResults && searchResults.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-sm shadow-lg max-h-64 overflow-y-auto" role="listbox" aria-label="City search results">
            {searchResults.map((city) => (
              <li key={`${city.id}-${city.latitude}`}>
                <button
                  onClick={() => selectCity(city)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                  role="option"
                  aria-selected="false"
                >
                  <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-gray-900">{city.name}</span>
                  {city.admin1 && <span className="text-gray-500">{city.admin1}</span>}
                  <span className="text-gray-400">{city.country}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showResults && searchResults.length === 0 && !searching && (
          <p className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-sm shadow-lg px-4 py-3 text-sm text-gray-500">
            No cities found. Try a different search.
          </p>
        )}
      </div>

      {loading && !weather && (
        <div className="space-y-6 animate-pulse">
          <div className="h-40 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded" />)}
          </div>
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-20" role="alert">
          <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-700 font-medium">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Showing default location on retry.</p>
        </div>
      )}

      {weather && !error && (
        <>
          {/* Current conditions */}
          <section aria-labelledby="current-conditions" className="bg-white rounded-sm border border-gray-200 shadow-sm p-6 mb-6">
            <h2 id="current-conditions" className="sr-only">Current weather conditions</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <WeatherIcon code={weather.current.weatherCode} className="h-16 w-16 text-gray-700" />
                <div>
                  <p className="text-5xl font-serif font-bold text-gray-900 leading-none">
                    {weather.current.temperature}°C
                  </p>
                  <p className="text-lg text-gray-600 mt-1">
                    {weatherLabel(weather.current.weatherCode)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {locationName}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Feels like <span className="font-semibold text-gray-700">{weather.current.apparentTemperature}°C</span>
              </p>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Droplets className="h-3.5 w-3.5" aria-hidden="true" /> Humidity
                </div>
                <p className="text-lg font-semibold text-gray-900">{weather.humidity}%</p>
              </div>
              <div className="bg-gray-50 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Wind className="h-3.5 w-3.5" aria-hidden="true" /> Wind
                </div>
                <p className="text-lg font-semibold text-gray-900">{weather.windSpeed} km/h</p>
              </div>
              <div className="bg-gray-50 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" /> Direction
                </div>
                <p className="text-lg font-semibold text-gray-900">{windDirectionLabel(weather.windDirection)}</p>
              </div>
              <div className="bg-gray-50 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> UV Index
                </div>
                <p className="text-lg font-semibold text-gray-900">{weather.uvIndex}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-4 text-xs text-gray-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Last updated: {formatTime(weather.updatedAt)}
            </div>
          </section>

          {/* Hourly forecast */}
          {weather.hourly.length > 0 && (
            <section aria-labelledby="hourly-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm p-6 mb-6">
              <h2 id="hourly-heading" className="text-lg font-serif font-bold text-gray-900 mb-4">
                Hourly Forecast — Next 24 Hours
              </h2>
              <div className="overflow-x-auto">
                <div className="flex gap-3 min-w-max pb-2">
                  {weather.hourly.map((h, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 w-16 shrink-0 text-center">
                      <span className="text-xs text-gray-500">{i === 0 ? 'Now' : formatHour(h.time)}</span>
                      <WeatherIcon code={h.weatherCode} className="h-6 w-6 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-900">{h.temperature}°</span>
                      <span className="text-[10px] text-blue-600">{h.precipitationProbability}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 7-day forecast */}
          {weather.daily.length > 0 && (
            <section aria-labelledby="daily-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm p-6 mb-6">
              <h2 id="daily-heading" className="text-lg font-serif font-bold text-gray-900 mb-4">
                7-Day Forecast
              </h2>
              <ol className="divide-y divide-gray-100">
                {weather.daily.map((d, i) => (
                  <li key={i} className="flex items-center gap-4 py-3">
                    <span className="w-12 text-sm font-medium text-gray-700">
                      {i === 0 ? 'Today' : formatDay(d.date)}
                    </span>
                    <WeatherIcon code={d.weatherCode} className="h-8 w-8 text-gray-600 shrink-0" />
                    <span className="text-sm text-gray-500 flex-1 min-w-0 truncate hidden sm:block">
                      {weatherLabel(d.weatherCode)}
                    </span>
                    <span className="text-sm text-gray-500 hidden md:flex items-center gap-1">
                      <Sunrise className="h-3 w-3" aria-hidden="true" /> {formatTime(d.sunrise)}
                      <Sunset className="h-3 w-3 ml-2" aria-hidden="true" /> {formatTime(d.sunset)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                      <span className="text-gray-900">{d.tempMax}°</span>
                      <span className="text-gray-400 ml-1">{d.tempMin}°</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* SEO content block */}
          <section className="prose-serif max-w-none mt-8" aria-labelledby="weather-info-heading">
            <h2 id="weather-info-heading" className="text-xl font-serif font-bold text-gray-900 mb-3">
              About Today's Weather in {locationName}
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The current temperature in {locationName} is {weather.current.temperature}°C with {weatherLabel(weather.current.weatherCode).toLowerCase()} conditions.
              It feels like {weather.current.apparentTemperature}°C with {weather.humidity}% humidity and winds of {weather.windSpeed} km/h from the {windDirectionLabel(weather.windDirection)}.
              Check back for the latest weather updates — this page refreshes automatically every {WEATHER_REFRESH_LABEL}.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
