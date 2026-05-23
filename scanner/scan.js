/**
 * San Marcos TX — No-Website Business Scanner
 * Uses Google Places API to find businesses that lack a website.
 *
 * SETUP:
 *   1. Get a free Google Places API key:
 *      https://console.cloud.google.com → Create project → Enable "Places API (New)" → Create API key
 *   2. Set env var:  GOOGLE_API_KEY=your_key_here
 *      (or paste it into the API_KEY line below for quick testing)
 *   3. Run:  node scan.js
 *
 * OUTPUT:
 *   - scanner/results/prospects_YYYY-MM-DD.csv  (import into prospects.html)
 *   - scanner/results/prospects_YYYY-MM-DD.json (raw data)
 *
 * COST:
 *   Nearby Search = $0.032/request | Place Details = $0.017/request
 *   Google gives $200 free credit/month — scanning all categories costs ~$5-15 total.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const API_KEY = process.env.GOOGLE_API_KEY || '';  // paste key here if needed

// San Marcos, TX center point
const LAT = 29.8833;
const LNG = -97.9414;
const RADIUS_METERS = 16000; // ~10 miles — covers San Marcos + nearby Kyle/Buda fringe

// Business types to scan. Add/remove as needed.
// Full list: https://developers.google.com/maps/documentation/places/web-service/supported_types
const DEFAULT_TYPES = [
  'restaurant',
  'cafe',
  'bakery',
  'meal_takeaway',
  'hair_care',
  'beauty_salon',
  'nail_salon',
  'spa',
  'car_repair',
  'car_wash',
  'electrician',
  'plumber',
  'general_contractor',
  'roofing_contractor',
  'painter',
  'locksmith',
  'gym',
  'clothing_store',
  'pet_store',
  'veterinary_care',
  'florist',
  'laundry',
  'real_estate_agency',
  'insurance_agency',
  'accounting',
  'storage',
  'moving_company',
  'cleaning_service',
];

// Milliseconds to wait between Place Details calls (avoids rate-limit errors)
const DELAY_MS = 150;

// ─── CATEGORY MAP (for dashboard display) ──────────────────────────────────────
const TYPE_TO_LABEL = {
  restaurant: 'Restaurant / Food',
  cafe: 'Restaurant / Food',
  bakery: 'Restaurant / Food',
  meal_takeaway: 'Restaurant / Food',
  meal_delivery: 'Restaurant / Food',
  food: 'Restaurant / Food',
  hair_care: 'Hair Salon / Barbershop',
  beauty_salon: 'Hair Salon / Barbershop',
  nail_salon: 'Nail Salon / Spa',
  spa: 'Nail Salon / Spa',
  car_repair: 'Auto Repair / Detailing',
  car_wash: 'Auto Repair / Detailing',
  car_dealer: 'Auto Repair / Detailing',
  electrician: 'Plumbing / HVAC / Electric',
  plumber: 'Plumbing / HVAC / Electric',
  general_contractor: 'Plumbing / HVAC / Electric',
  roofing_contractor: 'Plumbing / HVAC / Electric',
  painter: 'Plumbing / HVAC / Electric',
  locksmith: 'Plumbing / HVAC / Electric',
  gym: 'Fitness / Gym',
  clothing_store: 'Boutique / Retail',
  home_goods_store: 'Boutique / Retail',
  furniture_store: 'Boutique / Retail',
  pet_store: 'Pet Services',
  veterinary_care: 'Pet Services',
  florist: 'Boutique / Retail',
  laundry: 'Cleaning Service',
  cleaning_service: 'Cleaning Service',
  real_estate_agency: 'Real Estate',
  insurance_agency: 'Other',
  accounting: 'Other',
  storage: 'Other',
  moving_company: 'Other',
};

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function googleFetch(path, params) {
  const url = new URL(`https://maps.googleapis.com/maps/api${path}`);
  url.searchParams.set('key', API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

async function nearbySearch(type, pageToken) {
  const params = {
    location: `${LAT},${LNG}`,
    radius: RADIUS_METERS,
    type,
  };
  if (pageToken) params.pagetoken = pageToken;
  return googleFetch('/place/nearbysearch/json', params);
}

async function placeDetails(placeId) {
  return googleFetch('/place/details/json', {
    place_id: placeId,
    fields: 'place_id,name,formatted_phone_number,formatted_address,website,types,business_status,rating,user_ratings_total,url',
  });
}

function guessCategory(types = []) {
  for (const t of types) {
    if (TYPE_TO_LABEL[t]) return TYPE_TO_LABEL[t];
  }
  return 'Other';
}

function formatPhone(raw) {
  if (!raw) return '';
  return raw.replace(/\D/g, '').replace(/^1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}

function escCsv(val) {
  const s = String(val ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error('\n❌  No API key found.');
    console.error('   Set GOOGLE_API_KEY env var, or paste your key into scan.js line 39.\n');
    console.error('   Get a free key → https://console.cloud.google.com\n');
    process.exit(1);
  }

  // Parse --types flag if provided
  const typesArg = process.argv.find(a => a.startsWith('--types=') || a === '--types');
  let typesArgVal = null;
  if (typesArg) {
    const idx = process.argv.indexOf(typesArg);
    typesArgVal = typesArg.includes('=') ? typesArg.split('=')[1] : process.argv[idx + 1];
  }
  const TYPES = typesArgVal ? typesArgVal.split(',').map(t => t.trim()) : DEFAULT_TYPES;

  console.log(`\n🔍  San Marcos TX — Business Scanner`);
  console.log(`📍  Center: ${LAT}, ${LNG}  |  Radius: ${RADIUS_METERS / 1000}km`);
  console.log(`📂  Scanning ${TYPES.length} category types...\n`);

  const seen = new Set();         // avoid duplicate place_ids
  const prospects = [];           // businesses with no website
  const allScanned = [];          // everything scanned (for stats)

  for (const type of TYPES) {
    process.stdout.write(`  [${type}] Fetching listings...`);
    let pageToken = null;
    let pageNum = 0;
    let typeCount = 0;

    do {
      if (pageToken) await sleep(2000); // Google requires a short wait between pages
      let searchRes;
      try {
        searchRes = await nearbySearch(type, pageToken);
      } catch (err) {
        console.log(` ⚠  Search failed: ${err.message}`);
        break;
      }

      if (searchRes.status === 'REQUEST_DENIED') {
        console.log(`\n❌  API key rejected: ${searchRes.error_message}`);
        process.exit(1);
      }

      const places = searchRes.results || [];
      pageToken = searchRes.next_page_token || null;
      pageNum++;

      for (const place of places) {
        if (seen.has(place.place_id)) continue;
        seen.add(place.place_id);

        await sleep(DELAY_MS);

        let details;
        try {
          const detailRes = await placeDetails(place.place_id);
          details = detailRes.result || {};
        } catch {
          details = {};
        }

        const hasWebsite = !!details.website;
        const isOpen = details.business_status !== 'CLOSED_PERMANENTLY';

        allScanned.push({ name: place.name, hasWebsite, type });

        if (!hasWebsite && isOpen) {
          typeCount++;
          prospects.push({
            id: place.place_id,
            name: details.name || place.name,
            category: guessCategory(details.types || [type]),
            priority: 'medium',
            phone: formatPhone(details.formatted_phone_number),
            email: '',
            address: details.formatted_address || '',
            status: 'new',
            value: '',
            source: 'Google Places API',
            gmaps: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            notes: details.rating ? `Rating: ${details.rating} (${details.user_ratings_total || 0} reviews)` : '',
            addedDate: new Date().toISOString(),
          });
        }
      }
    } while (pageToken && pageNum < 3); // max 3 pages (60 results) per type

    console.log(` found ${typeCount} prospects`);
  }

  // ─── SAVE RESULTS ────────────────────────────────────────────────────────────
  const __dir = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dir, 'results');
  mkdirSync(outDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const jsonPath = join(outDir, `prospects_${date}.json`);
  const csvPath  = join(outDir, `prospects_${date}.csv`);

  // JSON (full data)
  writeFileSync(jsonPath, JSON.stringify(prospects, null, 2));

  // CSV (importable into prospects.html)
  const CSV_FIELDS = ['name','category','priority','phone','email','address','status','value','source','gmaps','notes','addedDate'];
  const csvHeader = CSV_FIELDS.join(',');
  const csvRows = prospects.map(p => CSV_FIELDS.map(f => escCsv(p[f])).join(','));
  writeFileSync(csvPath, csvHeader + '\n' + csvRows.join('\n'));

  // ─── SUMMARY ─────────────────────────────────────────────────────────────────
  const noWebPct = allScanned.length > 0
    ? Math.round((prospects.length / allScanned.length) * 100)
    : 0;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅  Scan complete!`);
  console.log(`   Total scanned:      ${allScanned.length} businesses`);
  console.log(`   No website found:   ${prospects.length} (${noWebPct}%)`);
  console.log(`\n   CSV  → ${csvPath}`);
  console.log(`   JSON → ${jsonPath}`);
  console.log(`\n💡  Import the CSV into prospects.html using the "Import CSV" button.\n`);

  // Top categories breakdown
  const byCat = {};
  for (const p of prospects) byCat[p.category] = (byCat[p.category] || 0) + 1;
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    console.log('   Prospects by category:');
    for (const [cat, count] of sorted) {
      console.log(`     ${count.toString().padStart(3)}  ${cat}`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error('\n❌  Unexpected error:', err.message);
  process.exit(1);
});
