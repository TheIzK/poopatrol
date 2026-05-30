export type RestroomStatus = 'unknown' | 'good' | 'okay' | 'bad'

export function getRestroomStatus(
  reviewCount: number,
  averageRating: number | null
): RestroomStatus {
  if (reviewCount === 0 || averageRating === null) return 'unknown'
  if (averageRating >= 4) return 'good'
  if (averageRating >= 2.5) return 'okay'
  return 'bad'
}

export const STATUS_LABEL: Record<RestroomStatus, string> = {
  unknown: 'No reviews yet',
  good: 'Good',
  okay: 'Okay',
  bad: 'Bad',
}

export const STATUS_BADGE_CLASS: Record<RestroomStatus, string> = {
  unknown: 'bg-gray-100 text-gray-500',
  good: 'bg-green-100 text-green-700',
  okay: 'bg-yellow-100 text-yellow-700',
  bad: 'bg-red-100 text-red-700',
}
