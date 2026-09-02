import { describe, expect, it } from 'vitest';
import { OpenMeteoWeatherProvider } from '../src/poc/weather/open-meteo';
import { scoreWeatherSuitability } from '../src/poc/scoring/preferences';

describe('weather mapping and scoring', () => {
  it('maps multi-location hourly forecast into a normalized summary', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify([
          {
            hourly: {
              time: ['2026-08-26T18:00:00Z', '2026-08-26T19:00:00Z', '2026-08-26T20:00:00Z'],
              temperature_2m: [18, 19, 17],
              apparent_temperature: [17, 18, 16],
              precipitation_probability: [10, 20, 15],
              precipitation: [0, 0.1, 0],
              wind_speed_10m: [12, 14, 11],
              wind_direction_10m: [180, 190, 200],
              wind_gusts_10m: [20, 22, 18],
              weather_code: [1, 2, 1],
            },
          },
        ]),
        { status: 200 },
      );

    const provider = new OpenMeteoWeatherProvider({ fetchImpl, baseUrl: 'https://weather.test' });
    const summary = await provider.forecast({
      samples: [
        { role: 'start', coordinate: { latitude: 37.77, longitude: -122.42 } },
        { role: 'midpoint', coordinate: { latitude: 37.78, longitude: -122.41 } },
        { role: 'farthest', coordinate: { latitude: 37.79, longitude: -122.4 } },
      ],
      departureInstant: new Date('2026-08-26T18:00:00.000Z'),
      durationSeconds: 7200,
    });

    expect(summary.status).toBe('ok');
    expect(summary.temperatureMinC).toBe(17);
    expect(summary.precipitationProbabilityMax).toBe(20);
    expect(JSON.stringify(summary)).not.toContain('weather.test');
  });

  it('does not treat missing weather as favorable', () => {
    const scored = scoreWeatherSuitability(null);
    expect(scored.score).toBeNull();
    expect(scored.raw.missing).toBe(true);
  });

  it('does not score incomplete weather payloads as dry/favorable', () => {
    const scored = scoreWeatherSuitability({
      status: 'ok',
      temperatureMinC: 18,
      temperatureMaxC: 20,
      apparentTemperatureMinC: null,
      apparentTemperatureMaxC: null,
      precipitationProbabilityMax: null,
      precipitationMm: null,
      windSpeedMaxKmh: null,
      windGustMaxKmh: null,
      weatherCodes: [],
      warnings: [],
      coverage: 1,
      confidence: 'high',
      provider: 'open_meteo',
      forecastGeneratedAtIso: '2026-08-26T18:00:00.000Z',
      intervalStartIso: '2026-08-26T18:00:00.000Z',
      intervalEndIso: '2026-08-26T20:00:00.000Z',
    });
    expect(scored.score).toBeNull();
    expect(scored.raw.incompleteFields).toBe(true);
  });
});
