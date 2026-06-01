'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { RestroomLocationSummary } from '@/types'
import { getRestroomStatus, STATUS_LABEL } from '@/lib/status'
import { getNavigationUrl } from '@/lib/navigation'

type Props = {
  locations: RestroomLocationSummary[]
  userLat: number
  userLng: number
}

const STATUS_COLORS = {
  unknown: '#9ca3af',
  good:    '#16a34a',
  okay:    '#d97706',
  bad:     '#dc2626',
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function MapView({ locations, userLat, userLng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl

      const map = L.map(containerRef.current, {
        center: [userLat, userLng],
        zoom: 13,
        zoomControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // User location dot
      L.circleMarker([userLat, userLng], {
        radius: 7,
        fillColor: '#3b82f6',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map).bindPopup('You are here')

      // Location markers
      for (const loc of locations) {
        const status = getRestroomStatus(loc.review_count, loc.average_rating)
        const color  = STATUS_COLORS[status]

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          popupAnchor: [0, -10],
        })

        const googleUrl = getNavigationUrl({ lat: loc.lat, lng: loc.lng, app: 'google' })
        const wazeUrl   = getNavigationUrl({ lat: loc.lat, lng: loc.lng, app: 'waze' })
        const reviewUrl = `/review/${loc.id}?name=${encodeURIComponent(loc.name)}`

        const popup = `
          <div style="min-width:180px;font-family:sans-serif;font-size:13px">
            <div style="font-weight:600;margin-bottom:2px">${esc(loc.name)}</div>
            <div style="color:#6b7280;margin-bottom:6px">${Number(loc.distance_miles).toFixed(1)} mi · ${STATUS_LABEL[status]}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <a href="${googleUrl}" target="_blank" rel="noopener noreferrer"
                style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;text-decoration:none;color:#374151;font-size:12px">
                Google Maps
              </a>
              <a href="${wazeUrl}" target="_blank" rel="noopener noreferrer"
                style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;text-decoration:none;color:#374151;font-size:12px">
                Waze
              </a>
              <a href="${reviewUrl}"
                style="padding:4px 8px;background:#f59e0b;border-radius:6px;text-decoration:none;color:white;font-size:12px;font-weight:500">
                Add Review
              </a>
            </div>
          </div>`

        L.marker([loc.lat, loc.lng], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 260 })
      }
    })

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapRef.current as any).remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Explicit px height so Leaflet can measure the container on init
  return (
    <div
      ref={containerRef}
      style={{ height: 'calc(100dvh - 56px)', width: '100%' }}
    />
  )
}
