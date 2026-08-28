import { describe, expect, it, vi } from 'vitest';
import { GenerationSession, shouldApplyGenerationResponse } from './generation-session';
import {
  applyManualStartSelection,
  buildLocationSuccessMessage,
  buildPoorAccuracyWarning,
  formatAccuracyDistance,
  geolocationErrorMessage,
  GEOLOCATION_REQUEST_OPTIONS,
  insecureContextGeolocationFailure,
  isGeolocationSupported,
  isPoorAccuracy,
  isSecureGeolocationContext,
  requestCurrentPosition,
  unsupportedGeolocationFailure,
} from './geolocation';
import { createMapRecenterRequest } from './map-recenter';

function mockGeolocationPositionError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function mockPosition(latitude: number, longitude: number, accuracy: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return {};
      },
    },
    timestamp: Date.now(),
    toJSON() {
      return {};
    },
  };
}

describe('geolocation helper', () => {
  it('detects unsupported geolocation', () => {
    expect(isGeolocationSupported(undefined)).toBe(false);
    expect(isGeolocationSupported({ geolocation: undefined as unknown as Geolocation })).toBe(
      false,
    );
    expect(unsupportedGeolocationFailure().reason).toBe('unsupported');
  });

  it('requires a secure context before requesting location', () => {
    expect(isSecureGeolocationContext({ isSecureContext: false })).toBe(false);
    expect(insecureContextGeolocationFailure().message).toContain('HTTPS or localhost');
    expect(insecureContextGeolocationFailure().message).toContain('pnpm run dev:mobile');
  });

  it('resolves a successful current position with accuracy', async () => {
    const getCurrentPosition = vi.fn(
      (success: PositionCallback, _error: PositionErrorCallback, options?: PositionOptions) => {
        expect(options).toEqual(GEOLOCATION_REQUEST_OPTIONS);
        success(mockPosition(37.77, -122.42, 35));
      },
    );

    const result = await requestCurrentPosition({ getCurrentPosition } as unknown as Geolocation);
    expect(result.coordinate).toEqual({ latitude: 37.77, longitude: -122.42 });
    expect(result.accuracyMeters).toBe(35);
    expect(buildLocationSuccessMessage(result.accuracyMeters)).toContain('110 ft');
  });

  it('maps permission denial to a useful message', () => {
    const failure = geolocationErrorMessage(mockGeolocationPositionError(1, 'denied'), true);
    expect(failure.reason).toBe('permission_denied');
    expect(failure.message).toContain('permission was denied');
  });

  it('explains secure-context requirements when permission fails on insecure pages', () => {
    const failure = geolocationErrorMessage(mockGeolocationPositionError(1, 'denied'), false);
    expect(failure.reason).toBe('insecure_context');
    expect(failure.message).toContain('HTTPS or localhost');
    expect(failure.message).toContain('pnpm run dev:mobile');
  });

  it('maps timeout and unavailable errors', async () => {
    const timeout = geolocationErrorMessage(mockGeolocationPositionError(3, 'timeout'), true);
    expect(timeout.reason).toBe('timeout');

    const unavailable = geolocationErrorMessage(
      mockGeolocationPositionError(2, 'unavailable'),
      true,
    );
    expect(unavailable.reason).toBe('position_unavailable');

    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error(mockGeolocationPositionError(3, 'timeout'));
    });
    await expect(
      requestCurrentPosition({ getCurrentPosition } as unknown as Geolocation),
    ).rejects.toMatchObject({ code: 3 });
  });

  it('warns on poor accuracy without rejecting the coordinate', () => {
    expect(isPoorAccuracy(650)).toBe(true);
    expect(buildPoorAccuracyWarning(650)).toContain('2130 ft');
    expect(isPoorAccuracy(1200)).toBe(true);
    expect(buildPoorAccuracyWarning(1200)).toContain('1200 m');
    expect(isPoorAccuracy(120)).toBe(false);
    expect(formatAccuracyDistance(120)).toBe('390 ft');
  });

  it('invalidates in-flight generation when applying a manual start selection', () => {
    const session = new GenerationSession();
    const inFlight = session.begin();
    const invalidate = () => {
      session.invalidate();
    };

    const applied = applyManualStartSelection(invalidate, {
      latitude: 37.77,
      longitude: -122.42,
    });

    expect(applied.start).toEqual({ latitude: 37.77, longitude: -122.42 });
    expect(shouldApplyGenerationResponse(session, inFlight.token, inFlight.signal)).toBe(false);
  });

  it('does not trigger route generation as part of location selection', async () => {
    const generate = vi.fn();
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success(mockPosition(1, 2, 20));
    });

    await requestCurrentPosition({ getCurrentPosition } as unknown as Geolocation);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('map recenter helper', () => {
  it('creates a keyed recenter request for controlled map updates', () => {
    const request = createMapRecenterRequest({ latitude: 33.1, longitude: -117.2 }, 15, 42);
    expect(request).toEqual({
      latitude: 33.1,
      longitude: -117.2,
      zoom: 15,
      key: 42,
    });
  });
});
