import L from 'leaflet';

/** DivIcon layout matched to the start pin so both labels stay aligned. */
export const END_MARKER_ICON_SIZE: [number, number] = [40, 56];
export const END_MARKER_ICON_ANCHOR: [number, number] = [20, 48];

export function endMarkerHtml(): string {
  return [
    '<div class="route-end-marker" aria-hidden="true">',
    '<div class="route-end-marker__pin"><span class="route-end-marker__letter">E</span></div>',
    '<span class="route-end-marker__label">END</span>',
    '</div>',
  ].join('');
}

export function createEndMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'route-end-marker-wrap',
    html: endMarkerHtml(),
    iconSize: END_MARKER_ICON_SIZE,
    iconAnchor: END_MARKER_ICON_ANCHOR,
  });
}
