-- PooPatrol v2 migration
-- Safe: only recreates restroom_reviews (no review data exists yet).
-- restroom_locations and all enriched metadata/photos are preserved.
-- Run this instead of the full schema.sql.

-- ── Recreate restroom_reviews (simplified) ────────────────────────────────────

DROP TABLE IF EXISTS restroom_reviews CASCADE;

CREATE TABLE restroom_reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID        NOT NULL REFERENCES restroom_locations(id) ON DELETE CASCADE,
  user_id        UUID,
  overall_rating INTEGER     NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  tags           TEXT[]      NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX restroom_reviews_location_idx ON restroom_reviews (location_id);

ALTER TABLE restroom_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read reviews" ON restroom_reviews;
DROP POLICY IF EXISTS "auth insert reviews"  ON restroom_reviews;

CREATE POLICY "public read reviews"
  ON restroom_reviews FOR SELECT USING (true);

CREATE POLICY "auth insert reviews"
  ON restroom_reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── Summary view (with top_tags) ──────────────────────────────────────────────

DROP VIEW IF EXISTS restroom_location_summary;

CREATE VIEW restroom_location_summary AS
SELECT
  rl.id,
  rl.name,
  rl.location_type,
  rl.brand,
  rl.address,
  rl.lat,
  rl.lng,
  rl.source,
  rl.seeded,
  rl.metadata,
  rl.created_at,
  rl.updated_at,
  COUNT(rr.id)::INT                         AS review_count,
  ROUND(AVG(rr.overall_rating)::NUMERIC, 2) AS average_rating,
  MAX(rr.created_at)                        AS last_reviewed_at,
  (
    SELECT array_agg(tag ORDER BY cnt DESC)
    FROM (
      SELECT unnest(r2.tags) AS tag, COUNT(*) AS cnt
      FROM restroom_reviews r2
      WHERE r2.location_id = rl.id
      GROUP BY tag
      ORDER BY cnt DESC
      LIMIT 3
    ) t
  ) AS top_tags
FROM restroom_locations rl
LEFT JOIN restroom_reviews rr ON rr.location_id = rl.id
GROUP BY rl.id;

-- ── RPC (with top_tags) ───────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS nearby_restroom_locations(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE FUNCTION nearby_restroom_locations(
  user_lat     DOUBLE PRECISION,
  user_lng     DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  location_type    TEXT,
  brand            TEXT,
  address          TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  source           TEXT,
  seeded           BOOLEAN,
  metadata         JSONB,
  review_count     INT,
  average_rating   NUMERIC,
  last_reviewed_at TIMESTAMPTZ,
  top_tags         TEXT[],
  distance_miles   DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.name,
    s.location_type,
    s.brand,
    s.address,
    s.lat,
    s.lng,
    s.source,
    s.seeded,
    s.metadata,
    s.review_count,
    s.average_rating,
    s.last_reviewed_at,
    s.top_tags,
    ROUND(
      (ST_Distance(
        ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) / 1609.344)::NUMERIC,
      1
    )::DOUBLE PRECISION AS distance_miles
  FROM restroom_location_summary s
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_miles * 1609.344
  )
  ORDER BY distance_miles ASC;
$$;
