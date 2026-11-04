import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
  Droplets, Wind, Compass, Gauge, Search, Loader2, AlertCircle, ArrowLeft,
  Sunrise, Sunset, Clock, MapPin, Thermometer, Eye, Cloudy, Moon, Activity,
  RefreshCw, ExternalLink, LocateFixed, ChevronDown,
} from 'lucide-react';
import {
  fetchFullWeather, searchCities, getInitialCoords, saveLocation,
  weatherIconName, weatherLabel, windDirectionLabel,
  type FullWeatherData, type CitySearchResult, type SavedLocation, type DailyForecast,
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

type TemperatureUnit = 'C' | 'F';

const WEATHER_FAQS = [
  {
    question: 'How often is the weather forecast updated?',
    answer: 'The USA Daily News weather page refreshes its forecast data approximately every 12 minutes. Forecast providers update their underlying weather models on their own schedules, so the newest model data may not be available at every refresh.',
  },
  {
    question: 'How far ahead can I see the weather forecast?',
    answer: 'The weather page displays an hourly outlook for the next 24 hours and a 10-day forecast with daily temperatures, precipitation chances, wind and UV information.',
  },
  {
    question: 'Where does the weather information come from?',
    answer: 'Weather forecasts are provided by Open-Meteo, which combines numerical weather prediction models from national weather services. Air-quality readings are model-based estimates and are provided separately by the Open-Meteo Air Quality API.',
  },
  {
    question: 'Can I check the weather in another city?',
    answer: 'Yes. Use the location search to select another city. Your selected location is saved in this browser so it can be used the next time you visit.',
  },
  {
    question: 'Are air-quality readings the same as measurements from a local monitoring station?',
    answer: 'No. Air-quality values on this page are model estimates at the selected location. They may differ from readings at nearby ground-based monitoring stations.',
  },
];

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const IconName = weatherIconName(code);
  const Icon = ICONS[IconName] ?? Cloud;
  return <Icon className={className} aria-hidden="true" />;
}

function displayTemperature(value: number, unit: TemperatureUnit): string {
  const converted = unit === 'F' ? (value * 9) / 5 + 32 : value;
  return `${Math.round(converted)}°${unit}`;
}

function formatHour(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return '—';
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12} ${suffix}`;
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '—';
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatClock(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return '—';
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatUpdated(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

function moonPhaseLabel(phase: number | null): string {
  if (phase === null || !Number.isFinite(phase)) return 'Unavailable';
  const value = ((phase % 1) + 1) % 1;
  if (value < 0.03 || value >= 0.97) return 'New moon';
  if (value < 0.22) return 'Waxing crescent';
  if (value < 0.28) return 'First quarter';
  if (value < 0.47) return 'Waxing gibbous';
  if (value < 0.53) return 'Full moon';
  if (value < 0.72) return 'Waning gibbous';
  if (value < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

function getUsAqiLabel(value: number | null): { label: string; detail: string; className: string } {
  if (value === null) return { label: 'Unavailable', detail: 'No model estimate returned', className: 'bg-gray-100 text-gray-700' };
  if (value <= 50) return { label: 'Good', detail: 'Air quality is satisfactory', className: 'bg-emerald-50 text-emerald-800' };
  if (value <= 100) return { label: 'Moderate', detail: 'Acceptable; some sensitive people may be affected', className: 'bg-yellow-50 text-yellow-800' };
  if (value <= 150) return { label: 'Unhealthy for sensitive groups', detail: 'Sensitive groups may experience effects', className: 'bg-orange-50 text-orange-800' };
  if (value <= 200) return { label: 'Unhealthy', detail: 'Some members of the public may experience effects', className: 'bg-red-50 text-red-800' };
  if (value <= 300) return { label: 'Very unhealthy', detail: 'Health alert: increased risk for everyone', className: 'bg-purple-50 text-purple-800' };
  return { label: 'Hazardous', detail: 'Health warning: avoid prolonged outdoor exertion', className: 'bg-rose-100 text-rose-900' };
}

function MetricCard({ icon: Icon, label, value, note }: {
  icon: typeof Sun;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function DailyForecastRow({ day, index, unit, expanded, onToggle }: {
  day: DailyForecast;
  index: number;
  unit: TemperatureUnit;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="border-b border-gray-100 last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="grid w-full grid-cols-[4.2rem_2rem_minmax(0,1fr)_auto_1.5rem] items-center gap-2 py-3 text-left hover:bg-gray-50 sm:grid-cols-[6rem_2.25rem_minmax(0,1fr)_auto_5rem_1.5rem]">
        <span className="text-xs font-semibold text-gray-700 sm:text-sm">{index === 0 ? 'Today' : formatDay(day.date)}</span>
        <WeatherIcon code={day.weatherCode} className="h-7 w-7 text-gray-600" />
        <span className="min-w-0 truncate text-xs text-gray-600 sm:text-sm">{weatherLabel(day.weatherCode)}</span>
        <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-gray-900">
          {displayTemperature(day.tempMax, unit)}
          <span className="ml-2 font-medium text-gray-400">{displayTemperature(day.tempMin, unit)}</span>
        </span>
        <span className="hidden text-right text-xs text-blue-700 sm:block">{day.precipitationProbability}% rain</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-3 bg-gray-50 px-3 pb-4 pt-1 text-xs sm:grid-cols-4">
          <div><p className="text-gray-500">Feels like</p><p className="mt-1 font-semibold text-gray-800">{displayTemperature(day.apparentTempMax, unit)} / {displayTemperature(day.apparentTempMin, unit)}</p></div>
          <div><p className="text-gray-500">Precipitation</p><p className="mt-1 font-semibold text-gray-800">{day.precipitationSum.toFixed(1)} mm · {day.precipitationHours}h</p></div>
          <div><p className="text-gray-500">Wind / gusts</p><p className="mt-1 font-semibold text-gray-800">{day.windSpeedMax} / {day.windGustsMax} km/h</p></div>
          <div><p className="text-gray-500">UV index maximum</p><p className="mt-1 font-semibold text-gray-800">{day.uvIndexMax.toFixed(1)}</p></div>
          <div><p className="text-gray-500">Dominant wind</p><p className="mt-1 font-semibold text-gray-800">{windDirectionLabel(day.windDirectionDominant)}</p></div>
          <div><p className="text-gray-500">Sunrise / sunset</p><p className="mt-1 font-semibold text-gray-800">{formatClock(day.sunrise)} / {formatClock(day.sunset)}</p></div>
          <div><p className="text-gray-500">Daylight</p><p className="mt-1 font-semibold text-gray-800">{formatDuration(day.daylightDuration)}</p></div>
          <div><p className="text-gray-500">Sunshine</p><p className="mt-1 font-semibold text-gray-800">{formatDuration(day.sunshineDuration)}</p></div>
        </div>
      )}
    </li>
  );
}

export function WeatherPage({ onBack }: WeatherPageProps) {
  const [weather, setWeather] = useState<FullWeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('Nairobi, Kenya');
  const [coords, setCoords] = useState({ lat: -1.2864, lon: 36.8172 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [unit, setUnit] = useState<TemperatureUnit>('C');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (lat: number, lon: number, name: string, quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const result = await fetchFullWeather(lat, lon, name);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setWeather(result.data);
      setLocationName(name);
      setError(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initial = await getInitialCoords();
      if (cancelled) return;
      setCoords(initial.coords);
      await load(initial.coords.lat, initial.coords.lon, initial.name);
    })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      load(coords.lat, coords.lon, locationName, true);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [coords, locationName, load]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setSearching(false);
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
    const fullName = [city.name, city.admin1, city.country].filter(Boolean).join(', ');
    const saved: SavedLocation = {
      name: fullName,
      lat: city.latitude,
      lon: city.longitude,
      country: city.country,
    };
    saveLocation(saved);
    setCoords({ lat: city.latitude, lon: city.longitude });
    setSearchQuery('');
    setShowResults(false);
    setExpandedDay(null);
    load(city.latitude, city.longitude, fullName);
  };

  const useMyLocation = async () => {
    const initial = await getInitialCoords();
    setCoords(initial.coords);
    load(initial.coords.lat, initial.coords.lon, initial.name);
  };

  const today = weather?.daily[0];
  const aqi = getUsAqiLabel(weather?.airQuality?.usAqi ?? null);
  const radarUrl = useMemo(() => {
    const params = new URLSearchParams({
      type: 'map',
      location: 'coordinates',
      zoom: '7',
      overlay: 'radar',
      product: 'ecmwf',
      level: 'surface',
      lat: String(coords.lat),
      lon: String(coords.lon),
      detailLat: String(coords.lat),
      detailLon: String(coords.lon),
      metricWind: 'default',
      metricTemp: unit === 'F' ? '°F' : '°C',
    });
    return `https://embed.windy.com/embed.html?${params.toString()}`;
  }, [coords, unit]);

  const seoTitle = `${locationName} Weather Forecast | USA Daily News`;
  const seoDescription = `Current weather in ${locationName}: conditions, feels-like temperature, hourly outlook, 10-day forecast, rain chances, wind and air quality.`;
  const canonicalUrl = `${SITE_CONFIG.url}/weather`;
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
      about: {
        '@type': 'Place',
        name: locationName,
        geo: { '@type': 'GeoCoordinates', latitude: coords.lat, longitude: coords.lon },
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_CONFIG.url },
          { '@type': 'ListItem', position: 2, name: 'Weather Forecast', item: canonicalUrl },
        ],
      },
    },
  ]), [seoTitle, seoDescription, canonicalUrl, locationName, coords]);

  useSeo({
    title: seoTitle,
    description: seoDescription,
    type: 'website',
    url: canonicalUrl,
    image: SITE_CONFIG.ogImage,
    jsonLd,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to homepage
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Weather centre</p>
          <h1 className="text-3xl font-serif font-bold text-gray-900 sm:text-4xl">Weather Forecast for {locationName}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
            Current conditions, a 24-hour weather outlook, a 10-day forecast, precipitation chances, wind, air quality and an interactive weather radar map.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1" aria-label="Temperature units">
            <button type="button" onClick={() => setUnit('C')} aria-pressed={unit === 'C'} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${unit === 'C' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>°C</button>
            <button type="button" onClick={() => setUnit('F')} aria-pressed={unit === 'F'} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${unit === 'F' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>°F</button>
          </div>
          <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400">
            <LocateFixed className="h-3.5 w-3.5" /> My location
          </button>
        </div>
      </div>

      <div className="relative mb-7 max-w-xl">
        <label htmlFor="city-search" className="sr-only">Search for a city or town</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id="city-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search any city or town…"
            className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
            aria-label="Search for a city or town"
            aria-expanded={showResults}
            aria-controls="weather-city-results"
            autoComplete="off"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />}
        </div>
        {showResults && searchResults.length > 0 && (
          <ul id="weather-city-results" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl" role="listbox" aria-label="City search results">
            {searchResults.map((city) => (
              <li key={`${city.id}-${city.latitude}-${city.longitude}`}>
                <button type="button" onClick={() => selectCity(city)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-gray-50" role="option" aria-selected="false">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="font-semibold text-gray-900">{city.name}</span>
                  {city.admin1 && <span className="text-gray-500">{city.admin1}</span>}
                  <span className="ml-auto text-xs text-gray-400">{city.country}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showResults && searchResults.length === 0 && !searching && (
          <p className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">No cities found. Try another spelling or nearby city.</p>
        )}
      </div>

      {loading && !weather && (
        <div className="space-y-5 animate-pulse" aria-label="Loading weather forecast">
          <div className="h-64 rounded-xl bg-gray-200" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} className="h-24 rounded-lg bg-gray-200" />)}</div>
          <div className="h-64 rounded-xl bg-gray-200" />
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{weather ? `A refresh could not be completed. Showing the most recently loaded forecast. ${error}` : error}</p>
        </div>
      )}

      {weather && (
        <>
          <section aria-labelledby="current-conditions" className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="grid gap-6 p-5 sm:grid-cols-[1.1fr_1fr] sm:p-7">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  <MapPin className="h-3.5 w-3.5" /> Current conditions · {locationName}
                </div>
                <div className="flex items-center gap-4">
                  <WeatherIcon code={weather.current.weatherCode} className="h-20 w-20 shrink-0 text-gray-700" />
                  <div>
                    <p className="font-serif text-6xl font-bold leading-none tracking-tight text-gray-900">{displayTemperature(weather.current.temperature, unit)}</p>
                    <p className="mt-2 text-base font-semibold text-gray-700">{weatherLabel(weather.current.weatherCode)}</p>
                    <p className="mt-1 text-sm text-gray-500">Feels like {displayTemperature(weather.current.apparentTemperature, unit)}</p>
                  </div>
                </div>
                <p className="mt-5 text-xs text-gray-500">
                  {today ? `Today's high ${displayTemperature(today.tempMax, unit)} · Low ${displayTemperature(today.tempMin, unit)}` : 'Current conditions for your selected location'}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="h-3.5 w-3.5" /> Updated {formatUpdated(weather.updatedAt, weather.timezone)}
                  {refreshing && <RefreshCw className="ml-1 h-3 w-3 animate-spin" aria-label="Refreshing weather" />}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Humidity</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{weather.current.humidity}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Wind</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{weather.current.windSpeed} km/h</p>
                  <p className="text-xs text-gray-500">{windDirectionLabel(weather.current.windDirection)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Chance of rain today</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{today?.precipitationProbability ?? '—'}{today ? '%' : ''}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">UV index</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{weather.current.uvIndex.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Current model estimate</p>
                </div>
              </div>
            </div>
          </section>

          <nav aria-label="Weather forecast sections" className="mb-6 flex flex-wrap gap-2 text-xs font-semibold">
            <a href="#hourly-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-gray-400">Hourly</a>
            <a href="#ten-day-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-gray-400">10-day forecast</a>
            <a href="#weather-details-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-gray-400">Weather details</a>
            <a href="#air-quality-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-gray-400">Air quality</a>
            <a href="#radar-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-gray-400">Radar & maps</a>
            <a href="#sun-moon-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-gray-400">Sun & moon</a>
          </nav>

          {weather.hourly.length > 0 && (
            <section aria-labelledby="hourly-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Plan the next day</p>
                  <h2 id="hourly-heading" className="mt-1 text-xl font-serif font-bold text-gray-900">Hourly weather forecast</h2>
                </div>
                <p className="text-xs text-gray-500">Next 24 hours · Local time</p>
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-3 pb-2">
                  {weather.hourly.map((hour, index) => (
                    <div key={hour.time} className="flex w-24 shrink-0 flex-col items-center rounded-lg bg-gray-50 px-2 py-3 text-center">
                      <span className="text-xs font-semibold text-gray-600">{index === 0 ? 'Now' : formatHour(hour.time)}</span>
                      <WeatherIcon code={hour.weatherCode} className="my-2 h-7 w-7 text-gray-700" />
                      <span className="text-base font-bold tabular-nums text-gray-900">{displayTemperature(hour.temperature, unit)}</span>
                      <span className="mt-2 flex items-center gap-1 text-[11px] text-blue-700"><Droplets className="h-3 w-3" />{hour.precipitationProbability}%</span>
                      <span className="mt-1 text-[10px] text-gray-500">{hour.precipitation.toFixed(1)} mm</span>
                      <span className="mt-2 text-[10px] text-gray-500">{hour.windSpeed} km/h wind</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">Precipitation probability is the forecast chance for the hour; rainfall amount is shown separately in millimetres.</p>
            </section>
          )}

          {weather.daily.length > 0 && (
            <section aria-labelledby="ten-day-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Longer-range outlook</p>
                  <h2 id="ten-day-heading" className="mt-1 text-xl font-serif font-bold text-gray-900">10-day weather forecast</h2>
                </div>
                <p className="text-xs text-gray-500">Select a day for more details</p>
              </div>
              <div className="grid grid-cols-[4.2rem_2rem_minmax(0,1fr)_auto_1.5rem] items-center gap-2 border-b border-gray-200 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:grid-cols-[6rem_2.25rem_minmax(0,1fr)_auto_5rem_1.5rem]">
                <span>Day</span><span></span><span>Conditions</span><span className="text-right">High / low</span><span className="hidden text-right sm:block">Rain</span><span></span>
              </div>
              <ol>
                {weather.daily.slice(0, 10).map((day, index) => (
                  <DailyForecastRow
                    key={day.date}
                    day={day}
                    index={index}
                    unit={unit}
                    expanded={expandedDay === day.date}
                    onToggle={() => setExpandedDay((current) => current === day.date ? null : day.date)}
                  />
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="weather-details-heading" className="mb-6">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Conditions at a glance</p>
              <h2 id="weather-details-heading" className="mt-1 text-xl font-serif font-bold text-gray-900">Current weather details</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard icon={Thermometer} label="Feels like" value={displayTemperature(weather.current.apparentTemperature, unit)} note="Apparent temperature" />
              <MetricCard icon={Droplets} label="Dew point" value={displayTemperature(weather.current.dewPoint, unit)} />
              <MetricCard icon={Droplets} label="Humidity" value={`${weather.current.humidity}%`} />
              <MetricCard icon={Wind} label="Wind speed" value={`${weather.current.windSpeed} km/h`} note={windDirectionLabel(weather.current.windDirection)} />
              <MetricCard icon={Wind} label="Wind gusts" value={`${weather.current.windGusts} km/h`} />
              <MetricCard icon={Gauge} label="Pressure" value={`${weather.current.pressure} hPa`} note="Mean sea-level pressure" />
              <MetricCard icon={Cloudy} label="Cloud cover" value={`${weather.current.cloudCover}%`} />
              <MetricCard icon={Eye} label="Visibility" value={weather.current.visibility === null ? '—' : `${(weather.current.visibility / 1000).toFixed(1)} km`} />
              <MetricCard icon={CloudRain} label="Precipitation" value={`${weather.current.precipitation.toFixed(1)} mm`} note="Current model interval" />
              <MetricCard icon={Sun} label="UV index" value={weather.current.uvIndex.toFixed(1)} />
            </div>
          </section>

          <section aria-labelledby="air-quality-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Outdoor conditions</p>
                <h2 id="air-quality-heading" className="mt-1 text-xl font-serif font-bold text-gray-900">Air quality in {locationName}</h2>
              </div>
              <span className="text-[11px] text-gray-400">Model estimates · Not a monitoring-station reading</span>
            </div>
            {weather.airQuality ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="text-xs text-gray-500">US Air Quality Index</p>
                    <p className="font-serif text-4xl font-bold tabular-nums text-gray-900">{weather.airQuality.usAqi ?? '—'}</p>
                  </div>
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${aqi.className}`}>{aqi.label}</span>
                    <p className="mt-2 text-sm text-gray-600">{aqi.detail}</p>
                  </div>
                  {weather.airQuality.europeanAqi !== null && <div className="ml-auto text-right"><p className="text-xs text-gray-500">European AQI</p><p className="text-2xl font-semibold tabular-nums text-gray-900">{Math.round(weather.airQuality.europeanAqi)}</p></div>}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCard icon={Activity} label="PM2.5" value={weather.airQuality.pm25 === null ? '—' : `${weather.airQuality.pm25.toFixed(1)} µg/m³`} />
                  <MetricCard icon={Activity} label="PM10" value={weather.airQuality.pm10 === null ? '—' : `${weather.airQuality.pm10.toFixed(1)} µg/m³`} />
                  <MetricCard icon={Activity} label="Ozone" value={weather.airQuality.ozone === null ? '—' : `${weather.airQuality.ozone.toFixed(1)} µg/m³`} />
                  <MetricCard icon={Activity} label="Nitrogen dioxide" value={weather.airQuality.nitrogenDioxide === null ? '—' : `${weather.airQuality.nitrogenDioxide.toFixed(1)} µg/m³`} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-gray-400">Air-quality information is interpolated from atmospheric forecast models. Use official local monitoring services and public-health guidance for safety-critical decisions.</p>
              </>
            ) : (
              <p className="rounded-lg bg-gray-50 px-4 py-5 text-sm text-gray-500">Air-quality estimates are temporarily unavailable for this location. Weather forecasts are still available.</p>
            )}
          </section>

          <section aria-labelledby="radar-heading" className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Explore local conditions</p>
                <h2 id="radar-heading" className="mt-1 text-xl font-serif font-bold text-gray-900">Weather radar & interactive map</h2>
                <p className="mt-1 text-sm text-gray-600">View precipitation radar and weather layers around {locationName}.</p>
              </div>
              <a href={radarUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
                Open full map <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <iframe
              key={`${coords.lat},${coords.lon}`}
              src={radarUrl}
              title={`Interactive weather radar map centred on ${locationName}`}
              width="100%"
              height="420"
              loading="lazy"
              allowFullScreen
              className="block w-full border-0 bg-gray-100"
            />
            <p className="p-3 text-[11px] text-gray-400">Interactive map provided by Windy. Radar and model-layer coverage varies by region; check official local weather warnings for severe-weather decisions.</p>
          </section>

          {today && (
            <section aria-labelledby="sun-moon-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Daylight information</p>
                <h2 id="sun-moon-heading" className="mt-1 text-xl font-serif font-bold text-gray-900">Sun & moon</h2>
                <p className="mt-1 text-xs text-gray-500">{formatDay(today.date)} · {locationName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard icon={Sunrise} label="Sunrise" value={formatClock(today.sunrise)} />
                <MetricCard icon={Sunset} label="Sunset" value={formatClock(today.sunset)} />
                <MetricCard icon={Moon} label="Moonrise" value={today.moonrise ? formatClock(today.moonrise) : '—'} />
                <MetricCard icon={Moon} label="Moonset" value={today.moonset ? formatClock(today.moonset) : '—'} />
                <MetricCard icon={Clock} label="Daylight" value={formatDuration(today.daylightDuration)} />
                <MetricCard icon={Sun} label="Sunshine" value={formatDuration(today.sunshineDuration)} />
                <MetricCard icon={Moon} label="Moon phase" value={moonPhaseLabel(today.moonPhase)} />
                <MetricCard icon={Wind} label="Peak wind" value={`${today.windSpeedMax} km/h`} note={windDirectionLabel(today.windDirectionDominant)} />
              </div>
            </section>
          )}

          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="weather-guide-heading">
            <h2 id="weather-guide-heading" className="mb-3 text-xl font-serif font-bold text-gray-900">Weather forecast for {locationName}</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-700">
              The latest forecast for {locationName} currently reports {weatherLabel(weather.current.weatherCode).toLowerCase()} conditions and a temperature of {displayTemperature(weather.current.temperature, unit)}. The feels-like temperature is {displayTemperature(weather.current.apparentTemperature, unit)}, with {weather.current.humidity}% relative humidity and winds around {weather.current.windSpeed} km/h.
            </p>
            <p className="text-sm leading-relaxed text-gray-700">
              Use the hourly outlook to compare temperature and rain chances through the next 24 hours. The 10-day forecast provides a longer-range view of daily highs and lows, precipitation, wind and UV index. Forecasts are model guidance and can change as new weather data becomes available.
            </p>
          </section>

          <section className="mb-8" aria-labelledby="weather-faq-heading">
            <h2 id="weather-faq-heading" className="mb-4 text-xl font-serif font-bold text-gray-900">Weather forecast FAQs</h2>
            <div className="space-y-4">
              {WEATHER_FAQS.map((entry) => (
                <article key={entry.question} className="border-b border-gray-200 pb-4">
                  <h3 className="mb-1 font-semibold text-gray-900">{entry.question}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{entry.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-start justify-between gap-2 border-t border-gray-200 pt-4 text-[11px] text-gray-400">
            <p>Weather forecast data: Open-Meteo · Air-quality model data: Open-Meteo Air Quality API · Radar map: Windy.</p>
            <p>Forecasts are guidance, not official emergency warnings.</p>
          </div>
        </>
      )}
    </div>
  );
}
