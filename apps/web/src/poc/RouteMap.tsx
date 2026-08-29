import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import { DirectionMarkerControls } from './DirectionMarkerControls';
import {
  defaultDirectionMarkerSettings,
  loadDirectionMarkerSettings,
  saveDirectionMarkerSettings,
  toSampleDirectionMarkerOptions,
  type DirectionMarkerSettingsV1,
} from './direction-marker-settings';
import {
  directionBadgeHtml,
  directionMarkerAccessibleLabel,
  sampleDirectionMarkers,
} from './route-direction';
import type { DirectionMarker } from './route-direction';
import type { MapRecenterRequest } from './map-recenter';
import { createStartMarkerIcon } from './start-marker';
import type { RejectedPreview } from './candidate-diagnostics';
import type { PocAlternative, PocCoordinate } from './types';
import { readCssColor, type ColorScheme } from './use-prefers-color-scheme';
import { routePresentationForName } from './layout/route-presentation';

const DEFAULT_CENTER: LatLngExpression = [37.7749, -122.4194];
const DEFAULT_ZOOM = 12;

const MAP_TILES = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

function numberedDirectionMarkerIcon(marker: DirectionMarker): L.DivIcon {
  return L.divIcon({
    className: 'route-direction-badge-marker',
    html: directionBadgeHtml(marker.sequence, marker.bearing, {
      kind: marker.kind,
      progress: marker.progress,
    }),
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

type InvalidateMapSizeProps = {
  layoutKey: string;
};

function InvalidateMapSize({ layoutKey }: InvalidateMapSizeProps) {
  const map = useMap();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [map, layoutKey]);

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
  /** Changes when planner chrome layout shifts so Leaflet can recalculate size. */
  layoutKey?: string;
  mapTheme: ColorScheme;
};

export function RouteMap({
  start,
  alternatives,
  selectedId,
  recenterRequest,
  rejectedPreview,
  onSelectStart,
  layoutKey = 'default',
  mapTheme,
}: RouteMapProps) {
  const tiles = MAP_TILES[mapTheme];
  const [markerSettings, setMarkerSettings] = useState<DirectionMarkerSettingsV1>(() =>
    defaultDirectionMarkerSettings(),
  );
  const [markerSettingsHydrated, setMarkerSettingsHydrated] = useState(false);

  useEffect(() => {
    setMarkerSettings(loadDirectionMarkerSettings());
    setMarkerSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!markerSettingsHydrated) {
      return;
    }
    saveDirectionMarkerSettings(markerSettings);
  }, [markerSettings, markerSettingsHydrated]);

  const routeColors = {
    selected: readCssColor('--rv-route-selected', '#2563eb'),
    unselected: readCssColor('--rv-route-unselected', '#64748b'),
    rejected: readCssColor('--rv-route-rejected', '#d97706'),
    flow: readCssColor('--rv-route-flow', '#ffffff'),
  };

  function colorForAlternative(alt: PocAlternative, selected: boolean): string {
    const identity = routePresentationForName(alt.name);
    const identityColor = readCssColor(identity.cssVar, identity.fallback);
    if (selected) {
      // Selected routes keep blue emphasis while retaining identity for unselected peers.
      return routeColors.selected;
    }
    return identityColor || routeColors.unselected;
  }

  const center: LatLngExpression = start ? [start.latitude, start.longitude] : DEFAULT_CENTER;
  const selectedAlternative =
    alternatives.find((alternative) => alternative.id === selectedId) ?? null;
  const unselectedAlternatives = alternatives.filter(
    (alternative) => alternative.id !== selectedId,
  );
  const directionMarkerOptions = useMemo(
    () => toSampleDirectionMarkerOptions(markerSettings),
    [markerSettings],
  );
  const directionMarkers = useMemo(
    () =>
      selectedAlternative
        ? sampleDirectionMarkers(selectedAlternative.geometry.coordinates, directionMarkerOptions)
        : [],
    [selectedAlternative, directionMarkerOptions],
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
        <TileLayer key={mapTheme} attribution={tiles.attribution} url={tiles.url} />
        <StartSelector onSelect={onSelectStart} />
        <FitRoutes
          start={start}
          alternatives={alternatives}
          selectedId={selectedId}
          rejectedPreview={rejectedPreview}
        />
        <RecenterMap request={recenterRequest} />
        <InvalidateMapSize layoutKey={`${layoutKey}-${mapTheme}`} />
        {rejectedPreview ? (
          <Polyline
            key={`rejected-preview-${rejectedPreview.attemptNumber}`}
            positions={rejectedPreviewPositions}
            pathOptions={{
              color: routeColors.rejected,
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
              color: colorForAlternative(alt, false),
              weight: 3,
              opacity: 0.55,
            }}
          />
        ))}
        {selectedAlternative ? (
          <>
            <Polyline
              key={`${selectedAlternative.id}-solid`}
              positions={selectedPositions}
              pathOptions={{
                color: colorForAlternative(selectedAlternative, true),
                weight: 5,
                opacity: 0.95,
                className: 'route-selected-solid',
              }}
            />
            <Polyline
              key={`${selectedAlternative.id}-flow`}
              positions={selectedPositions}
              pathOptions={{
                color: routeColors.flow,
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
            title={directionMarkerAccessibleLabel(marker)}
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
      <DirectionMarkerControls
        settings={markerSettings}
        markerCount={directionMarkers.length}
        onChange={setMarkerSettings}
        onReset={() => setMarkerSettings(defaultDirectionMarkerSettings())}
      />
      <p className="route-map-legend" aria-label="Map legend">
        {rejectedPreview ? (
          <>
            <span className="route-map-legend__short">
              {rejectedPreview.label} (dashed) · Start → numbered arrows
            </span>
            <span className="route-map-legend__full">
              {rejectedPreview.label} (dashed orange) · Start → follow numbered arrows in order
              (green → yellow → red). Markers tighten at turns; paired outlined arrows mark
              reversals or crossings.
            </span>
          </>
        ) : (
          <>
            <span className="route-map-legend__short">
              Start → numbered arrows (green → yellow → red)
            </span>
            <span className="route-map-legend__full">
              Start → follow numbered arrows in order (green → yellow → red). Markers tighten at
              turns; paired outlined arrows mark reversals or crossings.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
