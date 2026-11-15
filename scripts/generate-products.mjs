/**
 * Copies ./Road and ./Mountain into public/bikes/{road,mountain} and generates
 * src/data/products.js from the image file names
 * (e.g. "road_04_electric-blue-aero-tt.jpg" → "Electric Blue Aero TT", category Road).
 *
 * Run: npm run generate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CATEGORIES = [
  { dir: 'Road', key: 'road', label: 'Road' },
  { dir: 'Mountain', key: 'mountain', label: 'Mountain' },
];

const ACRONYMS = { tt: 'TT', xc: 'XC', emtb: 'eMTB', dh: 'DH' };

const titleCase = (slug) =>
  slug
    .split('-')
    .map((w) => ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Premium specs, keyed by "<category>-<number>". */
const SPECS = {
  'road-01': [28500, 'Toray T1000 Carbon', 7.2, 'Shimano Ultegra Di2 R8100 12s', '700c · 60 mm carbon aero',
    'A stealth aero machine sculpted in the wind tunnel for relentless speed.',
    'Hidden cabling and deep 60 mm carbon wheels make every watt count.'],
  'road-02': [32900, 'Toray T1100 Carbon', 6.6, 'SRAM Force AXS 2×12', '700c · 35 mm carbon',
    'A featherlight climber in glossy race red that lives for steep gradients.',
    'Stiff where it matters and just 6.6 kg – every climb becomes an attack.'],
  'road-03': [24500, 'High-Modulus Carbon', 7.9, 'Shimano 105 Di2 R7100 12s', '700c × 32 mm',
    'Endurance geometry wrapped in pearl white with hand-laid gold accents.',
    'Built for long, elegant days in the saddle with all-day comfort.'],
  'road-04': [41000, 'Toray T1100 Aero Carbon', 8.4, 'Shimano Dura-Ace Di2 R9200 TT', '700c · 80 mm carbon disc',
    'A time-trial weapon in electric blue, designed to slice through the air.',
    'Integrated aerobars and deep-section wheels for record-chasing pace.'],
  'road-05': [26800, 'Grade 9 Titanium (3Al/2.5V)', 8.1, 'SRAM Rival AXS 2×12', '700c × 30 mm',
    'Hand-welded brushed titanium that rides like silk and lasts a lifetime.',
    'Unpainted, timeless and practically indestructible.'],
  'road-06': [15900, 'Reynolds 853 Steel', 9.3, 'Shimano 105 R7100 12s', '700c × 32 mm tanwall',
    'Heritage racing green paired with classic tan-wall tyres.',
    'A modern steel ride with a lively, springy feel and timeless style.'],
  'road-07': [9800, 'Columbus Spirit Steel', 9.6, 'Shimano Tiagra 4700 10s', '700c × 28 mm',
    'A gleaming chrome classic inspired by the golden era of European racing.',
    'Polished details and a gentle steel ride for weekend café runs.'],
  'road-08': [19500, 'Carbon Monocoque', 7.6, 'SRAM Rival AXS 2×12', '700c · 45 mm carbon',
    'A sunset fade from vivid orange to deep purple that turns heads in the bunch.',
    'Race-ready geometry with sharp handling for crits and fast group rides.'],
  'road-09': [17200, 'Carbon Gravel Chassis', 8.6, 'SRAM Rival XPLR AXS 1×12', '700c × 40 mm gravel',
    'A stealth-grey all-road explorer with clearance for wide gravel tyres.',
    'From smooth tarmac to desert tracks – ready for wherever the road ends.'],
  'road-10': [36500, 'Toray T1000 Carbon', 6.9, 'Shimano Dura-Ace Di2 R9200 12s', '700c · 50 mm carbon',
    'A team-edition yellow replica of a WorldTour race machine.',
    'Power-meter ready, razor stiff and ferociously quick out of every corner.'],
  'road-11': [22400, 'High-Modulus Carbon', 7.1, 'Shimano Ultegra R8100 12s', '700c · 35 mm carbon',
    'Crisp navy and white livery on a lightweight, climbing-focused frame.',
    'Balanced, predictable and quick – the perfect partner for mountain passes.'],
  'road-12': [14200, 'Columbus Zona Steel', 9.0, 'Shimano 105 R7100 12s', '700c × 32 mm',
    'Rich burgundy paint with a honey leather saddle and matching bar tape.',
    'A refined endurance companion for long and comfortable miles.'],
  'road-13': [38900, 'Toray T1100 Carbon', 7.3, 'SRAM Red AXS 2×12', '700c · 55 mm carbon',
    'An iridescent oil-slick finish that shifts colour with every angle of light.',
    'A full aero build with SRAM Red AXS for pure, eye-catching speed.'],
  'road-14': [21000, 'Carbon Monocoque', 7.5, 'SRAM Force AXS 2×12', '700c · 45 mm carbon',
    'Fresh mint green over raw black carbon for a modern, minimal look.',
    'Agile all-rounder geometry that feels at home on any kind of road.'],
  'road-15': [45000, 'Toray M40X Carbon – Limited', 6.5, 'Shimano Dura-Ace Di2 R9200 12s', '700c · 50 mm carbon, gold hubs',
    'Limited to 50 hand-numbered frames in deep black with 24k gold detailing.',
    'The ultimate VELO VR flagship – lighter, stiffer and unmistakably exclusive.'],

  'mountain-01': [27500, 'Full Carbon · 170 mm travel', 14.8, 'SRAM X0 Eagle Transmission 1×12', '29"',
    'A matte-black carbon enduro rig built to win races against the clock.',
    '170 mm of travel that swallows rock gardens and still pedals efficiently.'],
  'mountain-02': [13900, '6066 Alloy · 140 mm travel', 15.2, 'Shimano SLX M7100 12s', '29"',
    'A bright orange trail bike that makes every ride feel like a weekend.',
    'Playful geometry and dependable Shimano SLX for all-day singletrack fun.'],
  'mountain-03': [9600, 'Alloy hardtail · 100 mm fork', 11.8, 'Shimano Deore M6100 12s', '29"',
    'An olive-green cross-country hardtail that is fast, light and honest.',
    'The ideal first step into racing or long desert-trail adventures.'],
  'mountain-04': [32000, 'Carbon DH · 200 mm travel', 16.2, 'SRAM X0 DH 7s', '29" / 27.5" mullet',
    'A pure white downhill weapon with a gleaming gold 200 mm fork.',
    'World-Cup inspired kinematics for unmatched control at full speed.'],
  'mountain-05': [24800, 'Carbon XC · 120 mm travel', 10.9, 'Shimano XTR M9100 12s', '29"',
    'A cobalt-blue full-suspension XC racer tuned for the podium.',
    'Lockout-ready suspension and a 10.9 kg build for explosive climbing.'],
  'mountain-06': [8000, 'Raw 6061 Aluminium', 12.6, 'Shimano Deore M5100 11s', '29"',
    'Brushed raw aluminium with an honest, industrial look.',
    'A tough, low-maintenance hardtail that is ready for anything.'],
  'mountain-07': [21500, 'Alloy freeride · 180 mm coil', 16.4, 'SRAM GX Eagle 1×12', '27.5"',
    'Red and black freeride muscle with a plush coil shock.',
    'Built for big drops, bike-park laps and fearless lines.'],
  'mountain-08': [36900, 'Carbon eMTB · 150 mm travel', 22.5, 'Shimano XT M8100 12s + EP801 motor', '29"',
    'A teal electric MTB with 85 Nm of smooth assistance and a 630 Wh battery.',
    'Climb twice as much, ride twice as far – and still have fun descending.'],
  'mountain-09': [12400, 'Alloy · 130 mm travel', 14.9, 'SRAM NX Eagle 1×12', '29"',
    'A sand-beige adventure trail bike made for long desert expeditions.',
    'Plenty of mounts for bags and bottles, with comfortable geometry.'],
  'mountain-10': [19900, 'Alloy enduro · 160 mm travel', 15.8, 'SRAM GX Eagle Transmission', '29" / 27.5" mullet',
    'Unmissable neon lime on a hard-charging, mullet-wheeled enduro chassis.',
    'Aggressive geometry and 160 mm of travel for the steepest trails.'],
  'mountain-11': [17800, 'Grade 9 Titanium hardtail', 11.4, 'Shimano XT M8100 12s', '29"',
    'A gunmetal titanium hardtail with a lively ride and a lifetime frame.',
    'Corrosion-proof, comfortable and perfectly understated.'],
  'mountain-12': [22900, 'Carbon trail · 150 mm travel', 14.1, 'SRAM X0 Eagle Transmission', '29"',
    'A purple chameleon finish that shifts colour as you move along the trail.',
    'A versatile 150 mm carbon trail bike – as at home climbing as descending.'],
  'mountain-13': [10800, 'Alloy fat-bike frame', 15.9, 'SRAM SX Eagle 1×12', '26" × 4.8" fat tyres',
    'A camo fat-tyre bike that floats over sand, snow and loose ground.',
    'Huge tyres and relaxed geometry for go-anywhere exploring.'],
  'mountain-14': [26200, 'Carbon downcountry · 120 mm', 11.6, 'SRAM XX SL Eagle Transmission', '29"',
    'Yellow and black downcountry speed – XC efficiency with trail confidence.',
    'Featherweight carbon with just enough travel to have fun on the descents.'],
  'mountain-15': [40000, 'Carbon Limited · 160 mm travel', 13.6, 'SRAM XX Eagle Transmission – Gold', '29"',
    'Limited to 50 hand-numbered frames in stealth black with gold hardware.',
    'Our flagship trail bike – every component chosen without compromise.'],
};

const products = [];

for (const cat of CATEGORIES) {
  const src = path.join(root, cat.dir);
  const dest = path.join(root, 'public', 'bikes', cat.key);
  fs.mkdirSync(dest, { recursive: true });

  const files = fs
    .readdirSync(src)
    .filter((f) => new RegExp(`^${cat.key}_\\d{2}_.+\\.jpe?g$`, 'i').test(f))
    .sort();

  for (const file of files) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
    const m = file.match(/^([a-z]+)_(\d{2})_(.+)\.jpe?g$/i);
    const number = Number(m[2]);
    const id = `${cat.key}-${m[2]}`;
    const spec = SPECS[id];
    if (!spec) throw new Error(`No specs for ${id}`);
    const [price, frame, weight, groupset, wheelSize, d1, d2] = spec;
    products.push({
      id,
      number,
      category: cat.key,
      categoryLabel: cat.label,
      slug: m[3],
      name: titleCase(m[3]),
      file: `bikes/${cat.key}/${file}`,
      price,
      frame,
      weight,
      groupset,
      wheelSize,
      sizes: ['S', 'M', 'L', 'XL'],
      description: [d1, d2],
      limited: number === 15,
    });
  }
}

const out = `// AUTO-GENERATED by scripts/generate-products.mjs from the image file names.
// Re-run \`npm run generate\` after adding or renaming bike photos.

const BASE = import.meta.env.BASE_URL;

export const PRODUCTS = ${JSON.stringify(products, null, 2)}.map((p) => ({ ...p, image: BASE + p.file }));

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
`;

fs.writeFileSync(path.join(root, 'src', 'data', 'products.js'), out);
console.log(`✔ Copied images and generated ${products.length} products → src/data/products.js`);
