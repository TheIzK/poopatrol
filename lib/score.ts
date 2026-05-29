export function getPooScoreLabel(score: number | null): string {
  if (score === null) return 'Unrated'
  if (score < 40) return 'Dump'
  if (score < 70) return 'Gets It Moving'
  if (score < 85) return 'Solid Stop'
  return 'No Wiper'
}

export function getPooScoreBadgeClass(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500'
  if (score < 40) return 'bg-red-100 text-red-700'
  if (score < 70) return 'bg-yellow-100 text-yellow-700'
  if (score < 85) return 'bg-blue-100 text-blue-700'
  return 'bg-green-100 text-green-700'
}
