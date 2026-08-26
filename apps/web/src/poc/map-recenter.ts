export type MapRecenterRequest = {
  latitude: number;
  longitude: number;
  zoom: number;
  key: number;
};

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export function createMapRecenterRequest(
  coordinate: MapCoordinate,
  zoom = 14,
  key: number = Date.now(),
): MapRecenterRequest {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    zoom,
    key,
  };
}
