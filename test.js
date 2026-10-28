// Smoke test: node test.js  (no server needed)
const assert = require('assert');
const http = require('http');
const app = require('./server');
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => [r.status, await r.json()]);
  try {
    const [s1, p] = await post('/v1/positions', { jd: 2448026.0, bodies: ['moon'] });
    assert.equal(s1, 200); assert(p.positions.moon.longitude >= 0 && p.positions.moon.longitude < 360);
    const [s2, a] = await post('/v1/ascendant', { jd: 2448026.0, latitude: 13.08, longitude: 80.27 });
    assert.equal(s2, 200); assert(a.ascendant >= 0 && a.ascendant < 360);
    const [s3] = await post('/v1/positions', { jd: 'x' }); assert.equal(s3, 400);
    const [s4] = await post('/v1/positions', { jd: 1, bodies: ['pluto'] }); assert.equal(s4, 400);
    const [s5, b] = await post('/v1/positions', { jds: [2448026.0, 2448027.0], bodies: ['sun'] }); assert.equal(s5, 200); assert.equal(b.results.length, 2);
    console.log('all tests passed');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { srv.close(); }
});
