/**
 * Weather service: browser geolocation, Open-Meteo forecasts and air quality.
 * No API keys are required. Falls back to Nairobi when location access is
 * unavailable or denied. Optional air-quality failures never hide the forecast.
 */

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  dewPoint: number;
  weatherCode: number;
  locationName: string;
  isDay: boolean;
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
  apparentTemperature: number;
  weatherCode: number;
  precipitationProbability: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  visibility: number | null;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  apparentTempMax: number;
  apparentTempMin: number;
  sunrise: string;
  sunset: string;
  moonrise: string | null;
  moonset: string | null;
  moonPhase: number | null;
  daylightDuration: number;
  sunshineDuration: number;
  precipitationSum: number;
  precipitationHours: number;
  precipitationProbability: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
  uvIndexMax: number;
}

export interface AirQualityData {
  europeanAqi: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
  sulphurDioxide: number | null;
  carbonMonoxide: number | null;
  updatedAt: string;
}

export interface FullWeatherData {
  current: WeatherData & {
    humidity: number;
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    pressure: number;
    cloudCover: number;
    precipitation: number;
    uvIndex: number;
    visibility: number | null;
  };
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  airQuality: AirQualityData | null;
  timezone: string;
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
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { data: FullWeatherData; expiry: number }>();

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

export function weatherLabel(code: number): string {
  return WEATHER_CODES[code] ?? 'Unknown';
}

export function windDirectionLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[((Math.round(deg / 22.5) % 16) + 16) % 16];
}

export interface SavedLocation {
  name: string;
  lat: number;
  lon: number;
  country?: string;
}

export function getSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLocation;
  } catch {
    return null;
  }
}

export function saveLocation(loc: SavedLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // Storage can be unavailable in private or restricted browsing modes.
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
    const json = await res.json() as { results?: Array<{ name?: string; admin1?: string; country?: string }> };
    const place = json.results?.[0];
    return [place?.name, place?.admin1, place?.country].filter(Boolean).join(', ') || DEFAULT_LOCATION.name;
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

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
      API_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const json = await res.json() as { results?: CitySearchResult[] };
    return (json.results ?? []);
  } catch {
    return [];
  }
}

export async function fetchWeather(): Promise<WeatherResult> {
  try {
    const saved = getSavedLocation();
    const coords = saved ?? await getPosition();
    const lat = 'lat' in coords ? coords.lat : (coords as SavedLocation).lat;
    const lon = 'lon' in coords ? coords.lon : (coords as SavedLocation).lon;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,apparent_temperature,dew_point_2m,weather_code,is_day';

    const res = await fetchWithTimeout(url, API_TIMEOUT_MS);
    if (!res.ok) return { error: { message: 'Weather service is currently unavailable.' } };
    const json = await res.json() as { current?: Record<string, number> };
    const current = json.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      return { error: { message: 'Could not read weather data.' } };
    }
    const locationName = saved?.name ?? await reverseGeocode(lat, lon);
    return {
      data: {
        temperature: Math.round(current.temperature_2m),
        apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
        dewPoint: Math.round(current.dew_point_2m ?? 0),
        weatherCode: current.weather_code ?? 0,
        isDay: current.is_day === 1,
        locationName,
      },
    };
  } catch {
    return { error: { message: 'Unable to load weather right now.' } };
  }
}

function currentLocationHour(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}`;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityData | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'european_aqi,us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide',
      timezone: 'auto',
    });
    const response = await fetchWithTimeout(`https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`, API_TIMEOUT_MS);
    if (!response.ok) return null;
    const json = await response.json() as { current?: Record<string, number | string> };
    const current = json.current;
    if (!current) return null;
    const hasAnyData = Object.values(current).some((value) => typeof value === 'number' && Number.isFinite(value));
    if (!hasAnyData) return null;
    return {
      europeanAqi: numberOrNull(current.european_aqi),
      usAqi: numberOrNull(current.us_aqi),
      pm25: numberOrNull(current.pm2_5),
      pm10: numberOrNull(current.pm10),
      ozone: numberOrNull(current.ozone),
      nitrogenDioxide: numberOrNull(current.nitrogen_dioxide),
      sulphurDioxide: numberOrNull(current.sulphur_dioxide),
      carbonMonoxide: numberOrNull(current.carbon_monoxide),
      updatedAt: typeof current.time === 'string' ? current.time : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchFullWeather(
  lat: number,
  lon: number,
  locationName: string
): Promise<FullWeatherResult> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return { data: cached.data };

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: [
        'temperature_2m', 'apparent_temperature', 'dew_point_2m',
        'relative_humidity_2m', 'weather_code', 'is_day',
        'precipitation', 'wind_speed_10m', 'wind_direction_10m',
        'wind_gusts_10m', 'pressure_msl', 'cloud_cover', 'uv_index',
      ].join(','),
      hourly: [
        'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
        'weather_code', 'precipitation_probability', 'precipitation',
        'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m',
        'visibility',
      ].join(','),
      daily: [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min',
        'apparent_temperature_max', 'apparent_temperature_min',
        'sunrise', 'sunset', 'moonrise', 'moonset', 'moon_phase',
        'daylight_duration', 'sunshine_duration', 'precipitation_sum',
        'precipitation_hours', 'precipitation_probability_max',
        'wind_speed_10m_max', 'wind_gusts_10m_max',
        'wind_direction_10m_dominant', 'uv_index_max',
      ].join(','),
      timezone: 'auto',
      forecast_days: '10',
      wind_speed_unit: 'kmh',
    });

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const [response, airQuality] = await Promise.all([
      fetchWithTimeout(forecastUrl, API_TIMEOUT_MS),
      fetchAirQuality(lat, lon),
    ]);
    if (!response.ok) return { error: { message: 'Weather service is currently unavailable.' } };
    const json = await response.json() as {
      timezone?: string;
      current?: Record<string, number>;
      hourly?: Record<string, Array<string | number | null>>;
      daily?: Record<string, Array<string | number | null>>;
    };

    const current = json.current;
    const hourlyData = json.hourly;
    const dailyData = json.daily;
    if (!current || typeof current.temperature_2m !== 'number' || !hourlyData || !dailyData) {
      return { error: { message: 'Could not read weather data.' } };
    }

    const timezone = json.timezone || 'UTC';
    const hourlyTimes = (hourlyData.time as string[] | undefined) ?? [];
    const currentHour = currentLocationHour(timezone);
    let startIndex = hourlyTimes.findIndex((time) => time.slice(0, 13) >= currentHour);
    if (startIndex < 0) startIndex = Math.max(0, hourlyTimes.length - 24);

    const hourly: HourlyForecast[] = [];
    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      hourly.push({
        time: hourlyTimes[i],
        temperature: Math.round(Number(hourlyData.temperature_2m?.[i] ?? current.temperature_2m)),
        apparentTemperature: Math.round(Number(hourlyData.apparent_temperature?.[i] ?? current.apparent_temperature ?? current.temperature_2m)),
        weatherCode: Number(hourlyData.weather_code?.[i] ?? current.weather_code ?? 0),
        precipitationProbability: Math.round(Number(hourlyData.precipitation_probability?.[i] ?? 0)),
        precipitation: Number(hourlyData.precipitation?.[i] ?? 0),
        humidity: Math.round(Number(hourlyData.relative_humidity_2m?.[i] ?? current.relative_humidity_2m ?? 0)),
        windSpeed: Math.round(Number(hourlyData.wind_speed_10m?.[i] ?? 0)),
        windGusts: Math.round(Number(hourlyData.wind_gusts_10m?.[i] ?? 0)),
        windDirection: Math.round(Number(hourlyData.wind_direction_10m?.[i] ?? 0)),
        visibility: numberOrNull(hourlyData.visibility?.[i]),
      });
    }

    const dailyTimes = (dailyData.time as string[] | undefined) ?? [];
    const daily: DailyForecast[] = dailyTimes.map((date, i) => ({
      date,
      weatherCode: Number(dailyData.weather_code?.[i] ?? 0),
      tempMax: Math.round(Number(dailyData.temperature_2m_max?.[i] ?? 0)),
      tempMin: Math.round(Number(dailyData.temperature_2m_min?.[i] ?? 0)),
      apparentTempMax: Math.round(Number(dailyData.apparent_temperature_max?.[i] ?? dailyData.temperature_2m_max?.[i] ?? 0)),
      apparentTempMin: Math.round(Number(dailyData.apparent_temperature_min?.[i] ?? dailyData.temperature_2m_min?.[i] ?? 0)),
      sunrise: String(dailyData.sunrise?.[i] ?? ''),
      sunset: String(dailyData.sunset?.[i] ?? ''),
      moonrise: typeof dailyData.moonrise?.[i] === 'string' ? String(dailyData.moonrise[i]) : null,
      moonset: typeof dailyData.moonset?.[i] === 'string' ? String(dailyData.moonset[i]) : null,
      moonPhase: numberOrNull(dailyData.moon_phase?.[i]),
      daylightDuration: Number(dailyData.daylight_duration?.[i] ?? 0),
      sunshineDuration: Number(dailyData.sunshine_duration?.[i] ?? 0),
      precipitationSum: Number(dailyData.precipitation_sum?.[i] ?? 0),
      precipitationHours: Number(dailyData.precipitation_hours?.[i] ?? 0),
      precipitationProbability: Math.round(Number(dailyData.precipitation_probability_max?.[i] ?? 0)),
      windSpeedMax: Math.round(Number(dailyData.wind_speed_10m_max?.[i] ?? 0)),
      windGustsMax: Math.round(Number(dailyData.wind_gusts_10m_max?.[i] ?? 0)),
      windDirectionDominant: Math.round(Number(dailyData.wind_direction_10m_dominant?.[i] ?? 0)),
      uvIndexMax: Number(dailyData.uv_index_max?.[i] ?? 0),
    }));

    const currentVisibility = numberOrNull(hourlyData.visibility?.[startIndex]);
    const data: FullWeatherData = {
      current: {
        temperature: Math.round(current.temperature_2m),
        apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
        dewPoint: Math.round(current.dew_point_2m ?? 0),
        weatherCode: Number(current.weather_code ?? 0),
        isDay: current.is_day === 1,
        locationName,
        humidity: Math.round(current.relative_humidity_2m ?? 0),
        windSpeed: Math.round(current.wind_speed_10m ?? 0),
        windDirection: Math.round(current.wind_direction_10m ?? 0),
        windGusts: Math.round(current.wind_gusts_10m ?? 0),
        pressure: Math.round(current.pressure_msl ?? 0),
        cloudCover: Math.round(current.cloud_cover ?? 0),
        precipitation: Number(current.precipitation ?? 0),
        uvIndex: Number(current.uv_index ?? 0),
        visibility: currentVisibility,
      },
      hourly,
      daily,
      airQuality,
      timezone,
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
    return { data };
  } catch {
    return { error: { message: 'Unable to load weather right now.' } };
  }
}

export async function getDeviceLocation(): Promise<{ coords: Coords; name: string }> {
  const coords = await getPosition();
  const name = await reverseGeocode(coords.lat, coords.lon);
  return { coords, name };
}

export async function getInitialCoords(): Promise<{ coords: Coords; name: string }> {
  const saved = getSavedLocation();
  if (saved) return { coords: { lat: saved.lat, lon: saved.lon }, name: saved.name };
  return getDeviceLocation();
}
