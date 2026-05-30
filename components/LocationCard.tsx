'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RestroomLocationSummary, LOCATION_TYPE_LABELS } from '@/types'
import { getRestroomStatus, STATUS_LABEL, STATUS_BADGE_CLASS } from '@/lib/status'
import { getNavigationUrl } from '@/lib/navigation'
import { getBrandLogoUrl } from '@/lib/brands'

const LOCATION_TYPE_EMOJI: Record<string, string> = {
  gas_station: '⛽',
  truck_stop: '🚛',
  rest_stop: '🛣️',
  travel_center: '🏪',
  restaurant: '🍽️',
  store: '🛒',
  park: '🌳',
  public_building: '🏛️',
  public_restroom: '🚻',
  other: '📍',
  unknown: '📍',
}

type Props = {
  location: RestroomLocationSummary
}

export default function LocationCard({ location }: Props) {
  const [logoError, setLogoError] = useState(false)

  const status = getRestroomStatus(location.review_count, location.average_rating)
  const typeLabel = LOCATION_TYPE_LABELS[location.location_type] ?? location.location_type
  const typeEmoji = LOCATION_TYPE_EMOJI[location.location_type] ?? '📍'
  const meta = location.metadata ?? {}

  const photoUrl = meta.google_photo_name
    ? `/api/photo?ref=${encodeURIComponent(meta.google_photo_name)}`
    : null

  const logoUrl = !logoError ? getBrandLogoUrl(location.brand) : null

  const displayName = location.brand && location.brand !== location.name
    ? `${location.name} · ${location.brand}`
    : location.name

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* Photo banner */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt={location.name}
          className="w-full h-36 object-cover"
          loading="lazy"
        />
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Brand logo or type emoji */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={location.brand ?? ''}
                className="w-8 h-8 rounded object-contain shrink-0 mt-0.5"
                onError={() => setLogoError(true)}
                loading="lazy"
              />
            ) : (
              <span className="text-xl shrink-0 mt-0.5" aria-hidden>{typeEmoji}</span>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 text-base leading-tight">
                {displayName}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{typeLabel}</p>
              {location.address && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{location.address}</p>
              )}
            </div>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Metadata row — phone, hours, wheelchair */}
        {(meta.phone || meta.opening_hours || meta.wheelchair) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            {meta.phone && (
              <a href={`tel:${meta.phone}`} className="hover:text-amber-600 transition-colors">
                📞 {meta.phone}
              </a>
            )}
            {meta.opening_hours && (
              <span>🕐 {meta.opening_hours}</span>
            )}
            {meta.wheelchair === 'yes' && (
              <span>♿ Accessible</span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{Number(location.distance_miles).toFixed(1)} mi away</span>
          {location.review_count > 0 && (
            <>
              <span>·</span>
              <span>{location.review_count} review{location.review_count === 1 ? '' : 's'}</span>
              {location.average_rating !== null && (
                <>
                  <span>·</span>
                  <span className="text-amber-500 font-medium">
                    {'★'.repeat(Math.round(location.average_rating))}
                    {'☆'.repeat(5 - Math.round(location.average_rating))}
                  </span>
                  <span>{Number(location.average_rating).toFixed(1)}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <a
            href={getNavigationUrl({ lat: location.lat, lng: location.lng, app: 'google' })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 px-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            Google Maps
          </a>
          <a
            href={getNavigationUrl({ lat: location.lat, lng: location.lng, app: 'waze' })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 px-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            Waze
          </a>
          <Link
            href={`/review/${location.id}?name=${encodeURIComponent(location.name)}`}
            className="flex-1 text-center py-2 px-2 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 active:bg-amber-700 transition-colors"
          >
            Add Review
          </Link>
        </div>
      </div>
    </div>
  )
}
