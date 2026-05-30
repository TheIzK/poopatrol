export type LocationType =
  | 'gas_station'
  | 'truck_stop'
  | 'rest_stop'
  | 'travel_center'
  | 'restaurant'
  | 'store'
  | 'park'
  | 'public_building'
  | 'public_restroom'
  | 'other'
  | 'unknown'

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  gas_station: 'Gas Station',
  truck_stop: 'Truck Stop',
  rest_stop: 'Rest Stop',
  travel_center: 'Travel Center',
  restaurant: 'Restaurant',
  store: 'Store',
  park: 'Park',
  public_building: 'Public Building',
  public_restroom: 'Public Restroom',
  other: 'Other',
  unknown: 'Unknown',
}

export type LocationMetadata = {
  // From OSM
  opening_hours?: string
  phone?: string
  website?: string
  wheelchair?: string
  toilets_wheelchair?: string
  operator?: string
  brand_wikidata?: string
  fee?: string
  access?: string
  osm_tags?: Record<string, string>
  // From Google Places (future enrichment)
  google_place_id?: string
  google_rating?: number
  google_photo_refs?: string[]
  google_photo_name?: string
  photo_url?: string
  google_hours?: string[]
  // Local / community
  known_as?: string
}

export type RestroomLocation = {
  id: string
  name: string
  location_type: LocationType
  brand: string | null
  address: string | null
  lat: number
  lng: number
  source: string | null
  source_id: string | null
  osm_type: string | null
  osm_id: string | null
  seeded: boolean
  metadata: LocationMetadata
  created_at: string
  updated_at: string
}

export type RestroomLocationSummary = {
  id: string
  name: string
  location_type: LocationType
  brand: string | null
  address: string | null
  lat: number
  lng: number
  source: string | null
  seeded: boolean
  metadata: LocationMetadata
  review_count: number
  average_rating: number | null
  average_cleanliness_rating: number | null
  last_reviewed_at: string | null
  distance_miles: number
}

export type RestroomReview = {
  id: string
  location_id: string
  user_id: string | null
  overall_rating: 1 | 2 | 3 | 4 | 5
  cleanliness_rating: (1 | 2 | 3 | 4 | 5) | null
  bathroom_open: boolean | null
  public_access: boolean | null
  customers_only: boolean | null
  key_required: boolean | null
  tp_available: boolean | null
  soap_available: boolean | null
  hand_dryer_or_towels: boolean | null
  accessible: boolean | null
  changing_table: boolean | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type OverallRating = 1 | 2 | 3 | 4 | 5

export type AddLocationFormData = {
  name: string
  location_type: LocationType | ''
  brand: string
  address: string
  lat: string
  lng: string
}
