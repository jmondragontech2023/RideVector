import type { PocCoordinate } from './types';

export const GEOLOCATION_REQUEST_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 0,
};

export const POOR_ACCURACY_THRESHOLD_METERS = 500;

export type GeolocationSuccess = {
  coordinate: PocCoordinate;
  accuracyMeters: number;
};

export type GeolocationFailureReason =
  | 'unsupported'
  | 'insecure_context'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown';

export type GeolocationFailure = {
  reason: GeolocationFailureReason;
  message: string;
};

export function isGeolocationSupported(
  navigatorLike: Pick<Navigator, 'geolocation'> | undefined,
): boolean {
  return typeof navigatorLike?.geolocation?.getCurrentPosition === 'function';
}

export function isSecureGeolocationContext(
  windowLike: Pick<Window, 'isSecureContext'> | undefined,
): boolean {
  return windowLike?.isSecureContext === true;
}

export function formatAccuracyDistance(accuracyMeters: number): string {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return 'unknown accuracy';
  }
  if (accuracyMeters < 1000) {
    const feet = Math.max(10, Math.round((accuracyMeters * 3.28084) / 10) * 10);
    return `${feet} ft`;
  }
  return `${Math.round(accuracyMeters)} m`;
}

export function isPoorAccuracy(accuracyMeters: number): boolean {
  return Number.isFinite(accuracyMeters) && accuracyMeters > POOR_ACCURACY_THRESHOLD_METERS;
}

export function geolocationErrorMessage(
  error: GeolocationPositionError,
  secureContext: boolean,
): GeolocationFailure {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      if (!secureContext) {
        return {
          reason: 'insecure_context',
          message:
            'Browser location requires HTTPS or localhost. Open the planner on a secure origin, then try again.',
        };
      }
      return {
        reason: 'permission_denied',
        message:
          'Location permission was denied. Allow location access or click the map to set a start manually.',
      };
    case error.POSITION_UNAVAILABLE:
      return {
        reason: 'position_unavailable',
        message:
          'Your location is temporarily unavailable. Try again or click the map to set a start manually.',
      };
    case error.TIMEOUT:
      return {
        reason: 'timeout',
        message: 'Location request timed out. Try again or click the map to set a start manually.',
      };
    default:
      return {
        reason: 'unknown',
        message: 'Unable to read your location. Click the map to set a start manually.',
      };
  }
}

export function unsupportedGeolocationFailure(): GeolocationFailure {
  return {
    reason: 'unsupported',
    message:
      'This browser does not support location access. Click the map to set a start manually.',
  };
}

export function insecureContextGeolocationFailure(): GeolocationFailure {
  return {
    reason: 'insecure_context',
    message:
      'Browser location requires HTTPS or localhost. Open the planner on a secure origin, then try again.',
  };
}

export function buildLocationSuccessMessage(accuracyMeters: number): string {
  return `Start set from your location (±${formatAccuracyDistance(accuracyMeters)}). Click the map to adjust the start.`;
}

export function buildPoorAccuracyWarning(accuracyMeters: number): string {
  return `Location accuracy is about ${formatAccuracyDistance(accuracyMeters)}. Consider clicking the map to refine the start.`;
}

export function requestCurrentPosition(
  geolocation: Geolocation,
  options: PositionOptions = GEOLOCATION_REQUEST_OPTIONS,
): Promise<GeolocationSuccess> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coordinate: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => {
        reject(error);
      },
      options,
    );
  });
}

/** Applies the same start-change semantics as a manual map click. */
export function applyManualStartSelection(
  invalidate: () => void,
  coordinate: PocCoordinate,
): {
  start: PocCoordinate;
} {
  invalidate();
  return { start: coordinate };
}
