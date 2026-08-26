// Minimal static server for the JS Self-Profiling Markers demo.
//
// Serves the same app at two routes so you can compare marker exposure:
//   /            (or /no-coi)  -> Document-Policy: js-profiling            (NOT isolated)
//   /coi                       -> Document-Policy + COOP + COEP            (cross-origin isolated)
//
// On localhost no Origin Trial token or browser flag is required during the trial.
// Works in both Microsoft Edge and Google Chrome.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8123;
const PUBLIC = path.join(__dirname, '..', 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  const isCOI = pathname === '/coi' || pathname.startsWith('/coi/');
  const isApp = pathname === '/' || pathname === '/no-coi' || pathname === '/coi' ||
                pathname === '/no-coi/' || pathname === '/coi/';

  // Serve the app HTML at the routes, static assets otherwise.
  let file;
  if (isApp) {
    file = path.join(PUBLIC, 'index.html');
  } else {
    // strip a leading /coi or /no-coi prefix if present so assets resolve
    const clean = pathname.replace(/^\/(coi|no-coi)/, '') || pathname;
    file = path.join(PUBLIC, path.normalize(clean).replace(/^(\.\.[/\\])+/, ''));
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };

    // The JS Self-Profiling API requires this Document Policy.
    headers['Document-Policy'] = 'js-profiling';

    if (isCOI) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }
    send(res, 200, data, headers);
  });
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('\nJS Self-Profiling Markers — demo server');
  console.log('=======================================');
  console.log(`  Not isolated : ${base}/no-coi   (style, layout markers)`);
  console.log(`  Isolated     : ${base}/coi      (all five markers)`);
  console.log('\nOpen in Microsoft Edge or Google Chrome. No flags needed on localhost.\n');
});
