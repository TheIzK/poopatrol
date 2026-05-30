export type MapApp = 'google' | 'waze'

export function getNavigationUrl({
  lat,
  lng,
  app,
}: {
  lat: number
  lng: number
  app: MapApp
}): string {
  if (app === 'waze') {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&utm_source=poopatrol`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
