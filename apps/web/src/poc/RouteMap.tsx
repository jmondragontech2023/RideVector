import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import { directionBadgeHtml, sampleDirectionMarkers } from './route-direction';
import type { DirectionMarker } from './route-direction';
import type { MapRecenterRequest } from './map-recenter';
import { createStartMarkerIcon } from './start-marker';
import type { RejectedPreview } from './candidate-diagnostics';
import type { PocAlternative, PocCoordinate } from './types';

const DEFAULT_CENTER: LatLngExpression = [37.7749, -122.4194];
const DEFAULT_ZOOM = 12;
const SELECTED_ROUTE_COLOR = '#0b6e4f';
const UNSELECTED_ROUTE_COLOR = '#7a8f84';
const REJECTED_PREVIEW_COLOR = '#d97706';

function numberedDirectionMarkerIcon(marker: DirectionMarker): L.DivIcon {
  return L.divIcon({
    className: 'route-direction-badge-marker',
    html: directionBadgeHtml(marker.sequence, marker.bearing),
    iconSize: [34, 42],
    iconAnchor: [17, 17],
  });
}

type StartSelectorProps = {
  onSelect: (coordinate: PocCoordinate) => void;
};

function StartSelector({ onSelect }: StartSelectorProps) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });
  return null;
}

type FitRoutesProps = {
  start: PocCoordinate | null;
  alternatives: PocAlternative[];
  selectedId: string | null;
  rejectedPreview: RejectedPreview | null;
};

function FitRoutes({ start, alternatives, selectedId, rejectedPreview }: FitRoutesProps) {
  const map = useMap();

  useEffect(() => {
    const points: Array<[number, number]> = [];
    if (start) {
      points.push([start.latitude, start.longitude]);
    }
    for (const alt of alternatives) {
      for (const [lon, lat] of alt.geometry.coordinates) {
        points.push([lat, lon]);
      }
    }
    if (rejectedPreview) {
      for (const [lon, lat] of rejectedPreview.geometry.coordinates) {
        points.push([lat, lon]);
      }
    }
    if (points.length === 0) {
      return;
    }
    if (points.length === 1) {
      map.setView(points[0]!, Math.max(map.getZoom(), 13));
      return;
    }
    map.fitBounds(points, { padding: [36, 36] });
  }, [map, start, alternatives, selectedId, rejectedPreview]);

  return null;
}

type RecenterMapProps = {
  request: MapRecenterRequest | null;
};

function RecenterMap({ request }: RecenterMapProps) {
  const map = useMap();

  useEffect(() => {
    if (!request) {
      return;
    }
    map.setView([request.latitude, request.longitude], request.zoom);
  }, [map, request]);

  return null;
}

function toPositions(coordinates: Array<[number, number]>): LatLngExpression[] {
  return coordinates.map(([lon, lat]) => [lat, lon] as LatLngExpression);
}

export type RouteMapProps = {
  start: PocCoordinate | null;
  alternatives: PocAlternative[];
  selectedId: string | null;
  recenterRequest: MapRecenterRequest | null;
  rejectedPreview: RejectedPreview | null;
  onSelectStart: (coordinate: PocCoordinate) => void;
};

export function RouteMap({
  start,
  alternatives,
  selectedId,
  recenterRequest,
  rejectedPreview,
  onSelectStart,
}: RouteMapProps) {
  const center: LatLngExpression = start ? [start.latitude, start.longitude] : DEFAULT_CENTER;
  const selectedAlternative =
    alternatives.find((alternative) => alternative.id === selectedId) ?? null;
  const unselectedAlternatives = alternatives.filter(
    (alternative) => alternative.id !== selectedId,
  );
  const directionMarkers = useMemo(
    () =>
      selectedAlternative ? sampleDirectionMarkers(selectedAlternative.geometry.coordinates) : [],
    [selectedAlternative],
  );
  const selectedPositions = selectedAlternative
    ? toPositions(selectedAlternative.geometry.coordinates)
    : [];
  const rejectedPreviewPositions = rejectedPreview
    ? toPositions(rejectedPreview.geometry.coordinates)
    : [];
  const startMarkerIcon = useMemo(() => createStartMarkerIcon(), []);

  return (
    <div className="route-map-wrap">
      <MapContainer center={center} zoom={DEFAULT_ZOOM} className="route-map" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <StartSelector onSelect={onSelectStart} />
        <FitRoutes
          start={start}
          alternatives={alternatives}
          selectedId={selectedId}
          rejectedPreview={rejectedPreview}
        />
        <RecenterMap request={recenterRequest} />
        {rejectedPreview ? (
          <Polyline
            key={`rejected-preview-${rejectedPreview.attemptNumber}`}
            positions={rejectedPreviewPositions}
            pathOptions={{
              color: REJECTED_PREVIEW_COLOR,
              weight: 4,
              opacity: 0.85,
              dashArray: '8 10',
              className: 'route-rejected-preview',
            }}
          />
        ) : null}
        {unselectedAlternatives.map((alt) => (
          <Polyline
            key={alt.id}
            positions={toPositions(alt.geometry.coordinates)}
            pathOptions={{
              color: UNSELECTED_ROUTE_COLOR,
              weight: 3,
              opacity: 0.45,
            }}
          />
        ))}
        {selectedAlternative ? (
          <>
            <Polyline
              key={`${selectedAlternative.id}-solid`}
              positions={selectedPositions}
              pathOptions={{
                color: SELECTED_ROUTE_COLOR,
                weight: 5,
                opacity: 0.95,
                className: 'route-selected-solid',
              }}
            />
            <Polyline
              key={`${selectedAlternative.id}-flow`}
              positions={selectedPositions}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                opacity: 0.75,
                dashArray: '10 14',
                className: 'route-flow-overlay',
              }}
            />
          </>
        ) : null}
        {directionMarkers.map((marker) => (
          <Marker
            key={`${selectedAlternative?.id ?? 'selected'}-direction-${marker.sequence}`}
            position={[marker.lat, marker.lon]}
            icon={numberedDirectionMarkerIcon(marker)}
            interactive={false}
            keyboard={false}
            bubblingMouseEvents={false}
            zIndexOffset={1200 + marker.sequence}
          />
        ))}
        {start ? (
          <Marker
            position={[start.latitude, start.longitude]}
            icon={startMarkerIcon}
            title="Route start"
            zIndexOffset={1600}
          />
        ) : null}
      </MapContainer>
      <p className="route-map-legend" aria-label="Map legend">
        {rejectedPreview
          ? `${rejectedPreview.label} (dashed orange) · Start → follow 1 → 2 → 3… on accepted routes`
          : 'Start → follow 1 → 2 → 3…'}
      </p>
    </div>
  );
}
