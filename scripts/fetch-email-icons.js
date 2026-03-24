const https = require('https');
const fs = require('fs');

const base = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/solid/';
const icons = [
  { key: 'calendar-check', name: 'calendar-check' },
  { key: 'circle-check', name: 'circle-check' },
  { key: 'clipboard-list', name: 'clipboard-list' },
  { key: 'user', name: 'user' },
  { key: 'user-doctor', name: 'user-doctor' },
  { key: 'calendar', name: 'calendar' },
  { key: 'clock', name: 'clock' },
  { key: 'stethoscope', name: 'stethoscope' },
  { key: 'location-dot', name: 'location-dot' },
  { key: 'list-check', name: 'list-check' },
  { key: 'info-circle', name: 'circle-info' },
  { key: 'phone', name: 'phone' },
  { key: 'envelope', name: 'envelope' },
  { key: 'calendar-xmark', name: 'calendar-xmark' },
  { key: 'circle-exclamation', name: 'circle-exclamation' },
  { key: 'calendar-plus', name: 'calendar-plus' },
  { key: 'triangle-exclamation', name: 'triangle-exclamation' },
  { key: 'calendar-minus', name: 'calendar-minus' }
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'text/html' } }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function main() {
  const out = {};
  for (const { key, name } of icons) {
    try {
      const svg = await fetch(base + name + '.svg');
      const pathMatch = svg.match(/<path\s+d="([^"]+)"/);
      const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
      if (pathMatch && viewBoxMatch) {
        out[key] = { d: pathMatch[1], viewBox: viewBoxMatch[1] };
        console.log('OK', key);
      } else {
        console.log('SKIP', key, 'no path');
      }
    } catch (e) {
      console.log('ERR', key, e.message);
    }
  }
  const outPath = require('path').join(__dirname, 'emailIconPaths.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Wrote scripts/emailIconPaths.json');
}

main();
