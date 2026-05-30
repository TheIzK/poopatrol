-- PooPatrol schema
-- Run this in the Supabase SQL editor.
-- Safe to re-run: drops and recreates everything cleanly.

-- ── Reset ────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS nearby_restroom_locations(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP VIEW  IF EXISTS restroom_location_summary;
DROP TABLE IF EXISTS restroom_reviews   CASCADE;
DROP TABLE IF EXISTS restroom_locations CASCADE;

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE restroom_locations (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT             NOT NULL,
  location_type   TEXT             NOT NULL DEFAULT 'unknown',
  brand           TEXT,
  address         TEXT,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  source          TEXT,
  source_id       TEXT,
  osm_type        TEXT,
  osm_id          TEXT,
  seeded          BOOLEAN          NOT NULL DEFAULT false,
  metadata        JSONB            NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT restroom_locations_source_unique UNIQUE (source, source_id)
);

CREATE TABLE restroom_reviews (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID        NOT NULL REFERENCES restroom_locations(id) ON DELETE CASCADE,
  user_id               UUID,
  overall_rating        INTEGER     CHECK (overall_rating BETWEEN 1 AND 5),
  cleanliness_rating    INTEGER     CHECK (cleanliness_rating BETWEEN 1 AND 5),
  bathroom_open         BOOLEAN,
  public_access         BOOLEAN,
  customers_only        BOOLEAN,
  key_required          BOOLEAN,
  tp_available          BOOLEAN,
  soap_available        BOOLEAN,
  hand_dryer_or_towels  BOOLEAN,
  accessible            BOOLEAN,
  changing_table        BOOLEAN,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX restroom_locations_geo_idx
  ON restroom_locations
  USING gist (ST_SetSRID(ST_MakePoint(lng, lat), 4326));

CREATE INDEX restroom_reviews_location_idx
  ON restroom_reviews (location_id);

-- ── Summary view ─────────────────────────────────────────────────────────────
-- review_count = 0 and average_rating = NULL for unreviewed locations.
-- Never treat NULL as bad.

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
  COUNT(rr.id)::INT                               AS review_count,
  ROUND(AVG(rr.overall_rating)::NUMERIC, 2)       AS average_rating,
  ROUND(AVG(rr.cleanliness_rating)::NUMERIC, 2)   AS average_cleanliness_rating,
  MAX(rr.created_at)                              AS last_reviewed_at
FROM restroom_locations rl
LEFT JOIN restroom_reviews rr ON rr.location_id = rl.id
GROUP BY rl.id;

-- ── RPC: nearby_restroom_locations ───────────────────────────────────────────

CREATE FUNCTION nearby_restroom_locations(
  user_lat     DOUBLE PRECISION,
  user_lng     DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
  id                         UUID,
  name                       TEXT,
  location_type              TEXT,
  brand                      TEXT,
  address                    TEXT,
  lat                        DOUBLE PRECISION,
  lng                        DOUBLE PRECISION,
  source                     TEXT,
  seeded                     BOOLEAN,
  metadata                   JSONB,
  review_count               INT,
  average_rating             NUMERIC,
  average_cleanliness_rating NUMERIC,
  last_reviewed_at           TIMESTAMPTZ,
  distance_miles             DOUBLE PRECISION
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
    s.average_cleanliness_rating,
    s.last_reviewed_at,
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

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE restroom_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restroom_reviews   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read locations"
  ON restroom_locations FOR SELECT USING (true);

CREATE POLICY "public insert locations"
  ON restroom_locations FOR INSERT WITH CHECK (true);

CREATE POLICY "public read reviews"
  ON restroom_reviews FOR SELECT USING (true);

CREATE POLICY "auth insert reviews"
  ON restroom_reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
