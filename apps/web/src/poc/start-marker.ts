import L from 'leaflet';

/** DivIcon layout tuned for crisp rendering on 1x and 2x displays. */
export const START_MARKER_ICON_SIZE: [number, number] = [40, 56];
export const START_MARKER_ICON_ANCHOR: [number, number] = [20, 48];

export function startMarkerHtml(): string {
  return [
    '<div class="route-start-marker" aria-hidden="true">',
    '<div class="route-start-marker__pin"><span class="route-start-marker__letter">S</span></div>',
    '<span class="route-start-marker__label">START</span>',
    '</div>',
  ].join('');
}

export function createStartMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'route-start-marker-wrap',
    html: startMarkerHtml(),
    iconSize: START_MARKER_ICON_SIZE,
    iconAnchor: START_MARKER_ICON_ANCHOR,
  });
}
