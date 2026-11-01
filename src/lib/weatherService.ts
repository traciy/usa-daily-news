/**
 * Weather service: geolocation + Open-Meteo API.
 * No API key required. Falls back to Nairobi, Kenya when geolocation
 * is unavailable or denied. Never throws — callers receive an error
 * object they can render as a friendly fallback.
 *
 * Supports current weather, hourly forecast (24h), and 7-day forecast.
 */

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  locationName: string;
  region?: string;
  country?: string;
}

export interface WeatherError {
  message: string;
}

export interface WeatherResult {
  data?: WeatherData;
  error?: WeatherError;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  sunrise: string;
  sunset: string;
  precipitationProbability: number;
  windSpeedMax: number;
  uvIndexMax: number;
}

export interface FullWeatherData {
  current: WeatherData;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  uvIndex: number;
  updatedAt: string;
}

export interface FullWeatherResult {
  data?: FullWeatherData;
  error?: WeatherError;
}

interface Coords {
  lat: number;
  lon: number;
}

export const DEFAULT_LOCATION = {
  name: 'Nairobi',
  region: 'Nairobi County',
  country: 'Kenya',
  lat: -1.2864,
  lon: 36.8172,
};

const GEO_TIMEOUT_MS = 8000;
const API_TIMEOUT_MS = 10000;
const STORAGE_KEY = 'usadaily.weather.location';
// In-memory cache keyed by lat,lon to avoid hammering the API on re-renders.
const cache = new Map<string, { data: FullWeatherData; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** WMO weather codes mapped to readable descriptions. */
export const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

/** Map a WMO weather code to a lucide-react icon name. */
export function weatherIconName(code: number): string {
  if (code === 0 || code === 1) return 'Sun';
  if (code === 2) return 'CloudSun';
  if (code === 3) return 'Cloud';
  if (code === 45 || code === 48) return 'CloudFog';
  if (code >= 51 && code <= 57) return 'CloudDrizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'CloudRain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'CloudSnow';
  if (code >= 95) return 'CloudLightning';
  return 'Cloud';
}

/** Human-readable condition label from a WMO weather code. */
export function weatherLabel(code: number): string {
  return WEATHER_CODES[code] ?? 'Unknown';
}

/** Convert a wind direction in degrees to a compass label. */
export function windDirectionLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export interface SavedLocation {
  name: string;
  lat: number;
  lon: number;
  country?: string;
}

/** Read the last-saved location from localStorage (or null). */
export function getSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLocation;
  } catch {
    return null;
  }
}

/** Persist a location to localStorage so it persists across reloads. */
export function saveLocation(loc: SavedLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // storage may be unavailable (private mode) — silently ignore
  }
}

function getPosition(): Promise<Coords> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon }),
      { timeout: GEO_TIMEOUT_MS, maximumAge: 600_000 }
    );
  });
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`,
      API_TIMEOUT_MS
    );
    if (!res.ok) return DEFAULT_LOCATION.name;
    const json = await res.json();
    return json?.results?.[0]?.name ?? DEFAULT_LOCATION.name;
  } catch {
    return DEFAULT_LOCATION.name;
  }
}

export interface CitySearchResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

/** Search for cities by name using the Open-Meteo geocoding API. */
export async function searchCities(query: string): Promise<CitySearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
      API_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.results ?? []) as CitySearchResult[];
  } catch {
    return [];
  }
}

/** Fetch current weather for the dashboard widget (lightweight). */
export async function fetchWeather(): Promise<WeatherResult> {
  try {
    const { lat, lon } = await getPosition();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code`;

    const res = await fetchWithTimeout(url, API_TIMEOUT_MS);
    if (!res.ok) return { error: { message: 'Weather service is currently unavailable.' } };
    const json = await res.json();
    const current = json?.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      return { error: { message: 'Could not read weather data.' } };
    }
    const locationName = await reverseGeocode(lat, lon);
    return {
      data: {
        temperature: Math.round(current.temperature_2m),
        apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
        weatherCode: current.weather_code,
        locationName,
      },
    };
  } catch {
    return { error: { message: 'Unable to load weather right now.' } };
  }
}

/**
 * Fetch full weather data: current conditions, 24h hourly forecast, and
 * 7-day daily forecast. Uses an in-memory cache keyed by coordinates.
 */
export async function fetchFullWeather(
  lat: number,
  lon: number,
  locationName: string
): Promise<FullWeatherResult> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return { data: cached.data };
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,uv_index` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max,uv_index_max` +
      `&timezone=auto&forecast_days=7`;

    const res = await fetchWithTimeout(url, API_TIMEOUT_MS);
    if (!res.ok) return { error: { message: 'Weather service is currently unavailable.' } };
    const json = await res.json();

    const cur = json?.current;
    if (!cur || typeof cur.temperature_2m !== 'number') {
      return { error: { message: 'Could not read weather data.' } };
    }

    const hourly: HourlyForecast[] = [];
    const hourlyTimes: string[] = json?.hourly?.time ?? [];
    const nowHour = new Date().getHours();
    for (let i = 0; i < hourlyTimes.length; i++) {
      const t = new Date(hourlyTimes[i]);
      // Only include the next 24 hours starting from the current hour.
      if (t.getHours() === nowHour && t.getDate() === new Date().getDate()) {
        for (let j = i; j < Math.min(i + 24, hourlyTimes.length); j++) {
          hourly.push({
            time: json.hourly.time[j],
            temperature: Math.round(json.hourly.temperature_2m[j]),
            weatherCode: json.hourly.weather_code[j],
            precipitationProbability: json.hourly.precipitation_probability?.[j] ?? 0,
          });
        }
        break;
      }
    }

    const daily: DailyForecast[] = [];
    const dailyTimes: string[] = json?.daily?.time ?? [];
    for (let i = 0; i < dailyTimes.length; i++) {
      daily.push({
        date: json.daily.time[i],
        weatherCode: json.daily.weather_code[i],
        tempMax: Math.round(json.daily.temperature_2m_max[i]),
        tempMin: Math.round(json.daily.temperature_2m_min[i]),
        sunrise: json.daily.sunrise[i],
        sunset: json.daily.sunset[i],
        precipitationProbability: json.daily.precipitation_probability_max?.[i] ?? 0,
        windSpeedMax: Math.round(json.daily.wind_speed_10m_max?.[i] ?? 0),
        uvIndexMax: json.daily.uv_index_max?.[i] ?? 0,
      });
    }

    const data: FullWeatherData = {
      current: {
        temperature: Math.round(cur.temperature_2m),
        apparentTemperature: Math.round(cur.apparent_temperature ?? cur.temperature_2m),
        weatherCode: cur.weather_code,
        locationName,
      },
      hourly,
      daily,
      humidity: Math.round(cur.relative_humidity_2m ?? 0),
      windSpeed: Math.round(cur.wind_speed_10m ?? 0),
      windDirection: Math.round(cur.wind_direction_10m ?? 0),
      precipitation: cur.precipitation ?? 0,
      uvIndex: Math.round(cur.uv_index ?? 0),
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
    return { data };
  } catch {
    return { error: { message: 'Unable to load weather right now.' } };
  }
}

/** Get coordinates for the initial location: saved > geolocation > Nairobi. */
export async function getInitialCoords(): Promise<{ coords: Coords; name: string }> {
  const saved = getSavedLocation();
  if (saved) {
    return { coords: { lat: saved.lat, lon: saved.lon }, name: saved.name };
  }
  const coords = await getPosition();
  const name = await reverseGeocode(coords.lat, coords.lon);
  return { coords, name };
}
