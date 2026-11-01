/**
 * Weather service: geolocation + Open-Meteo API.
 * No API key required. Falls back to Nairobi, Kenya when geolocation
 * is unavailable or denied. Never throws — callers receive an error
 * object they can render as a friendly fallback.
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

/** Map a WMO weather code to a lucide-react icon name (imported by the widget). */
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

/** Fetch current weather for the user's location (or Nairobi fallback). */
export async function fetchWeather(): Promise<WeatherResult> {
  try {
    const { lat, lon } = await getPosition();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code`;

    const res = await fetchWithTimeout(url, API_TIMEOUT_MS);
    if (!res.ok) {
      return { error: { message: 'Weather service is currently unavailable.' } };
    }
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
