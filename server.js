// SwissS2S: Swiss Ephemeris over HTTP. Copyright (C) 2026 Konda Academy. Licensed under AGPL-3.0-only (see LICENSE).
// Uses the Swiss Ephemeris (Astrodienst AG, AGPL), through the `sweph` Node binding.
// Deliberately thin: positions and the ascendant only. No astrology interpretation lives here.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sweph = require('sweph');

const SOURCE_URL = 'https://github.com/konda-in/SwissS2S';
const PORT = process.env.PORT || 5100;
const API_KEY = process.env.SWISS_API_KEY || '';
const MAX_JDS = Number(process.env.MAX_JDS || 400);

if (process.env.NODE_ENV === 'production' && !API_KEY) {
  console.error('SWISS_API_KEY is required in production');
  process.exit(1);
}

const C = sweph.constants;
sweph.set_ephe_path(path.join(__dirname, 'ephe')); // data files 1800-2399; the built-in Moshier model is the fallback
sweph.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);
const SIDEREAL = C.SEFLG_SIDEREAL | C.SEFLG_SPEED;

const BODIES = {
  sun: C.SE_SUN, moon: C.SE_MOON, mars: C.SE_MARS, mercury: C.SE_MERCURY,
  jupiter: C.SE_JUPITER, venus: C.SE_VENUS, saturn: C.SE_SATURN, true_node: C.SE_TRUE_NODE,
};

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '64kb' }));

// AGPL section 13: tell every user of the service where the corresponding source is.
app.use((req, res, next) => { res.set('X-Source-Code', SOURCE_URL); next(); });
app.get('/', (req, res) => res.json({ service: 'SwissS2S', license: 'AGPL-3.0-only', source: SOURCE_URL }));
app.get('/source', (req, res) => res.redirect(302, SOURCE_URL));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT || 600), standardHeaders: true, legacyHeaders: false }));

app.use((req, res, next) => {
  if (!API_KEY) return next(); // open only when no key is configured (local development)
  const got = Buffer.from(String(req.get('x-api-key') || ''));
  const want = Buffer.from(API_KEY);
  if (got.length === want.length && crypto.timingSafeEqual(got, want)) return next();
  res.status(401).json({ error: 'unauthorized' });
});

const bad = (res, msg) => res.status(400).json({ error: msg });
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// POST /v1/positions  { jd | jds[], bodies?: ["sun", ...] }  ->  sidereal (Lahiri) longitude, latitude, distance, speed
app.post('/v1/positions', (req, res) => {
  const { jd, jds, bodies } = req.body || {};
  const list = jds !== undefined ? jds : [jd];
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_JDS || !list.every(isNum)) return bad(res, `jd must be a number, or jds an array of 1-${MAX_JDS} numbers`);
  const names = bodies === undefined ? Object.keys(BODIES) : bodies;
  if (!Array.isArray(names) || names.length === 0 || !names.every((n) => Object.hasOwn(BODIES, n))) return bad(res, `bodies must be a subset of: ${Object.keys(BODIES).join(', ')}`);

  const results = list.map((j) => {
    const positions = {};
    for (const n of names) {
      const r = sweph.calc_ut(j, BODIES[n], SIDEREAL);
      if (r.error && !r.data) throw new Error(r.error);
      const [longitude, latitude, distance, speed_longitude] = r.data;
      positions[n] = { longitude, latitude, distance, speed_longitude };
    }
    return { jd: j, positions };
  });
  res.json(jds !== undefined ? { results } : results[0]);
});

// POST /v1/ascendant  { jd, latitude, longitude }  ->  sidereal (Lahiri) ascendant and midheaven, Placidus
app.post('/v1/ascendant', (req, res) => {
  const { jd, latitude, longitude } = req.body || {};
  if (![jd, latitude, longitude].every(isNum) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return bad(res, 'jd, latitude (-90..90) and longitude (-180..180) must be numbers');
  const r = sweph.houses_ex(jd, SIDEREAL, latitude, longitude, 'P');
  res.json({ ascendant: r.data.points[0], midheaven: r.data.points[1] });
});

app.use((err, req, res, next) => {
  console.error(JSON.stringify({ level: 'error', msg: err.message }));
  res.status(err.status && err.status < 500 ? err.status : 500).json({ error: err.status && err.status < 500 ? err.message : 'ephemeris calculation failed' });
});

if (require.main === module) app.listen(PORT, () => console.log(JSON.stringify({ level: 'info', msg: 'swisss2s started', port: PORT })));
module.exports = app;
