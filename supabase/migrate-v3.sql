-- PooPatrol v3 migration
-- Additive: adds unique index to prevent duplicate reviews.
-- Safe to run against existing data (no table drops).

CREATE UNIQUE INDEX IF NOT EXISTS restroom_reviews_one_per_location
  ON restroom_reviews (user_id, location_id)
  WHERE user_id IS NOT NULL;
