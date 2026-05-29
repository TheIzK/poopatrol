export type NearbyBathroom = {
  bathroom_id: string
  name: string
  address: string | null
  city: string
  state: string
  lat: number
  lng: number
  interstate: string | null
  exit_number: string | null
  bathroom_type: string | null
  distance_miles: number
  poo_score: number | null
  review_count: number
}

export type PooRating = 1 | 2 | 3

export type PositiveTag =
  | 'clean'
  | 'tp_stocked'
  | 'soap_available'
  | 'towels_or_dryer'
  | 'lock_worked'
  | 'good_privacy'
  | 'easy_to_find'
  | 'easy_highway_access'
  | 'plenty_stalls'
  | 'felt_safe'
  | 'changing_table'
  | 'kid_friendly'
  | 'well_lit'
  | 'single_user_or_family'

export type IssueTag =
  | 'dirty'
  | 'no_tp'
  | 'no_soap'
  | 'no_towels_or_dryer'
  | 'broken_lock'
  | 'poor_privacy'
  | 'hard_to_find'
  | 'hard_highway_access'
  | 'long_line'
  | 'felt_unsafe'
  | 'not_public'
  | 'closed'

export type Bathroom = {
  id: string
  name: string
  address: string | null
  city: string
  state: string
  lat: number
  lng: number
  interstate: string | null
  exit_number: string | null
  bathroom_type: string | null
  created_by: string | null
  is_seed_data: boolean
  data_source: string
  created_at: string
}

export type AddBathroomFormData = {
  name: string
  address: string
  city: string
  state: string
  lat: string
  lng: string
  interstate: string
  exit_number: string
  bathroom_type: string
}
