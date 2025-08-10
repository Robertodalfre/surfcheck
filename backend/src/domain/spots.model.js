import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, '../../data/spots.json');

const SectorSchema = z.tuple([z.number(), z.number()]);

const SpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  beachAzimuth: z.number(),
  swellWindow: SectorSchema,
  windShelter: z.object({
    offshore: SectorSchema.optional(),
    badOnshore: SectorSchema.optional(),
  }),
  bottomType: z.enum(['beachbreak', 'point', 'reef']).default('beachbreak'),
  tidePreference: z.array(z.enum(['low', 'mid', 'high', 'mid-high'])).optional().default([]),
  tideSensitivity: z.number().min(0).max(1).optional().default(0.5),
  idealApproach: SectorSchema,
  shadowBlocks: z.array(SectorSchema).optional().default([]),
  localNotes: z.string().optional().default(''),
});

let spots = [];

function loadSpots() {
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const json = JSON.parse(raw);
  const parsed = z.array(SpotSchema).safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid spots.json: ' + parsed.error.message);
  }
  spots = parsed.data;
}

loadSpots();

export function getAllSpots() {
  return spots;
}

export function getSpotById(id) {
  return spots.find((s) => s.id === id);
}
