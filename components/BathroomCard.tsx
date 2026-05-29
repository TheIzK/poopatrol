'use client'

import Link from 'next/link'
import { NearbyBathroom } from '@/types'
import { getPooScoreLabel, getPooScoreBadgeClass } from '@/lib/score'

type Props = {
  bathroom: NearbyBathroom
}

export default function BathroomCard({ bathroom }: Props) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bathroom.lat},${bathroom.lng}`
  const label = getPooScoreLabel(bathroom.poo_score)
  const badgeClass = getPooScoreBadgeClass(bathroom.poo_score)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-base leading-tight truncate">
            {bathroom.name}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {bathroom.city}, {bathroom.state}
          </p>
          {(bathroom.interstate || bathroom.exit_number) && (
            <p className="text-sm text-gray-500">
              {bathroom.interstate && <span>{bathroom.interstate}</span>}
              {bathroom.interstate && bathroom.exit_number && <span> · </span>}
              {bathroom.exit_number && <span>Exit {bathroom.exit_number}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
            {label}
          </span>
          {bathroom.poo_score !== null && (
            <span className="text-xs text-gray-400">{Math.round(bathroom.poo_score)}/100</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>{bathroom.distance_miles.toFixed(1)} mi away</span>
        <span>·</span>
        <span>
          {bathroom.review_count === 0
            ? 'No reviews yet'
            : `${bathroom.review_count} review${bathroom.review_count === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Directions
        </a>
        <Link
          href={`/review/${bathroom.bathroom_id}?name=${encodeURIComponent(bathroom.name)}`}
          className="flex-1 text-center py-2 px-3 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 active:bg-amber-700 transition-colors"
        >
          Review
        </Link>
      </div>
    </div>
  )
}
