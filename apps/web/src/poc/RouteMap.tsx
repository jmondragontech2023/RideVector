import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { chevronRotationDegrees, sampleDirectionMarkers } from './route-direction';
import type { PocAlternative, PocCoordinate } from './types';

const DEFAULT_CENTER: LatLngExpression = [37.7749, -122.4194];
const DEFAULT_ZOOM = 12;

// Vite bundles Leaflet images; keep default marker icons working.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function directionMarkerIcon(bearing: number): L.DivIcon {
  const rotation = chevronRotationDegrees(bearing);
  return L.divIcon({
    className: 'route-direction-marker',
    html: `<span class="route-direction-marker__chevron" style="transform: rotate(${rotation}deg)" aria-hidden="true">▶</span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
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
};

function FitRoutes({ start, alternatives, selectedId }: FitRoutesProps) {
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
    if (points.length === 0) {
      return;
    }
    if (points.length === 1) {
      map.setView(points[0]!, Math.max(map.getZoom(), 13));
      return;
    }
    map.fitBounds(points, { padding: [36, 36] });
  }, [map, start, alternatives, selectedId]);

  return null;
}

export type RouteMapProps = {
  start: PocCoordinate | null;
  alternatives: PocAlternative[];
  selectedId: string | null;
  onSelectStart: (coordinate: PocCoordinate) => void;
};

export function RouteMap({ start, alternatives, selectedId, onSelectStart }: RouteMapProps) {
  const center: LatLngExpression = start ? [start.latitude, start.longitude] : DEFAULT_CENTER;
  const selectedAlternative =
    alternatives.find((alternative) => alternative.id === selectedId) ?? null;
  const directionMarkers = useMemo(
    () =>
      selectedAlternative ? sampleDirectionMarkers(selectedAlternative.geometry.coordinates) : [],
    [selectedAlternative],
  );

  return (
    <div className="route-map-wrap">
      <MapContainer center={center} zoom={DEFAULT_ZOOM} className="route-map" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <StartSelector onSelect={onSelectStart} />
        <FitRoutes start={start} alternatives={alternatives} selectedId={selectedId} />
        {alternatives.map((alt) => {
          const positions = alt.geometry.coordinates.map(
            ([lon, lat]) => [lat, lon] as LatLngExpression,
          );
          const selected = alt.id === selectedId;
          return (
            <Polyline
              key={alt.id}
              positions={positions}
              pathOptions={{
                color: selected ? '#0b6e4f' : '#7a8f84',
                weight: selected ? 5 : 3,
                opacity: selected ? 0.95 : 0.45,
              }}
            />
          );
        })}
        {directionMarkers.map((marker, index) => (
          <Marker
            key={`${selectedAlternative?.id ?? 'selected'}-direction-${index}`}
            position={[marker.lat, marker.lon]}
            icon={directionMarkerIcon(marker.bearing)}
            interactive={false}
            keyboard={false}
            bubblingMouseEvents={false}
          />
        ))}
        {start ? (
          <Marker position={[start.latitude, start.longitude]} title="Start">
            <Tooltip permanent direction="top" offset={[0, -30]} className="route-start-tooltip">
              Start
            </Tooltip>
          </Marker>
        ) : null}
      </MapContainer>
      <div className="route-map-legend" aria-label="Map legend">
        <span className="route-map-legend__arrow" aria-hidden="true">
          ▶
        </span>
        <span>Arrows show travel direction on the selected route.</span>
      </div>
    </div>
  );
}
