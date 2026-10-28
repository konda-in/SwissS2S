# SwissS2S

A small HTTP service around the [Swiss Ephemeris](https://www.astro.com/swisseph/) (through the [`sweph`](https://www.npmjs.com/package/sweph) Node binding).
It returns planet positions and the ascendant as JSON. It contains **no astrology interpretation**: signs, houses, dashas and readings are the caller's business.

Licence: **GNU AGPL v3** (see `LICENSE`), the same as the Swiss Ephemeris. If you run a modified copy as a network service, section 13 requires you to offer your users its source. This service sends an `X-Source-Code` header and serves `/` and `/source` for that purpose.
Swiss Ephemeris is by Astrodienst AG. The data files in `ephe/` (1800-2399) come from https://github.com/aloistr/swisseph/tree/master/ephe

## Run
```bash
npm install
SWISS_API_KEY=change-me npm start          # port 5100; without SWISS_API_KEY it is open (development only)
npm test
docker build -t swisss2s . && docker run -p 5100:5100 -e SWISS_API_KEY=change-me swisss2s
```
In production (`NODE_ENV=production`) the service refuses to start without `SWISS_API_KEY`. Calls must send it as `X-API-Key`.

## API
All positions are **sidereal, Lahiri ayanamsa**, in degrees. `jd` is the Julian day (UT).

| Method and path | Body | Returns |
|---|---|---|
| `GET /health` | | `{ "status": "ok" }` |
| `GET /`, `GET /source` | | licence and source link |
| `POST /v1/positions` | `{ "jd": 2448026.0, "bodies": ["sun","moon"] }` | `{ "jd", "positions": { "sun": { "longitude", "latitude", "distance", "speed_longitude" }, ... } }` |
| `POST /v1/positions` | `{ "jds": [..up to 400..], "bodies": [...] }` | `{ "results": [ { "jd", "positions" }, ... ] }` |
| `POST /v1/ascendant` | `{ "jd", "latitude", "longitude" }` | `{ "ascendant", "midheaven" }` (Placidus) |

Bodies: `sun moon mars mercury jupiter venus saturn true_node` (default: all). A negative `speed_longitude` means retrograde.
Limits: 64 KB body, 600 requests per minute (`RATE_LIMIT`), 400 days per batch (`MAX_JDS`).

## Deploy
See `Dockerfile`. Environment: `SWISS_API_KEY` (required in production), `PORT` (default 5100).
