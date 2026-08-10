# PooPatrol

Find clean bathrooms near interstate exits.

A crowdsourced map for road trips: pull up nearby exits, see which gas
stations and rest stops have decent bathrooms, and add tags like
clean/dirty, has TP, key required, or accessible based on your own stop.
Locations are enriched with brand data (Shell, BP, Chevron, etc.) and
seeded from OpenStreetMap and Google Places.

Live at [poopatrol.vercel.app](https://poopatrol.vercel.app).

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + auth)
- Leaflet for the map view
- Tailwind CSS

## Features

- Map view of nearby locations with clean/dirty scoring
- Add a bathroom and tag its condition
- Review and tag existing locations
- Brand recognition for major gas station chains

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires a `.env.local`
with Supabase credentials (see `lib/supabase.ts`).
