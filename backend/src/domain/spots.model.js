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
  // Novos campos (opcionais) para agrupamento regional
  region: z.string().optional(),
  regionName: z.string().optional()
});

let spots = [];

function loadSpots() {
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const json = JSON.parse(raw);
  const parsed = z.array(SpotSchema).safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid spots.json: ' + parsed.error.message);
  }
  const baseSpots = parsed.data;

  // Mapear regiões por ID de pico (fallback quando JSON não tiver region)
  const regionMap = {
    // Ubatuba (SP)
    ubatuba: {
      name: 'Ubatuba (SP)',
      ids: ['sape','lagoinha','itamambuca','vermelha_norte','toninhas','vermelha_centro','enseada','grande','felix','domingas_dias']
    },
    // São Sebastião (SP)
    sao_sebastiao: {
      name: 'São Sebastião (SP)',
      ids: ['maresias','barra_sahy','camburi','boiçucanga']
    },
    // Florianópolis (SC)
    florianopolis: {
      name: 'Florianópolis (SC)',
      ids: ['joaquina','mole','barra_lagoa','campeche','armacao']
    },
    // Rio de Janeiro (RJ)
    rio_de_janeiro: {
      name: 'Rio de Janeiro (RJ)',
      ids: ['recreio','barra_tijuca','ipanema','copacabana','prainha','grumari']
    }
  };

  const idToRegion = new Map();
  for (const [key, def] of Object.entries(regionMap)) {
    def.ids.forEach((id) => idToRegion.set(id, { region: key, regionName: def.name }));
  }

  spots = baseSpots.map((s) => {
    // Se já vier com region no JSON, manter; senão, atribuir por mapping
    if (s.region && s.regionName) return s;
    const reg = idToRegion.get(s.id);
    return reg ? { ...s, region: reg.region, regionName: reg.regionName } : s;
  });
}

loadSpots();

export function getAllSpots() {
  return spots;
}

export function getSpotById(id) {
  return spots.find((s) => s.id === id);
}

export function getRegions() {
  const set = new Map();
  for (const s of spots) {
    if (s.region) set.set(s.region, s.regionName || s.region);
  }
  return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
}

export function getSpotsByRegion(regionId) {
  return spots.filter((s) => s.region === regionId);
}
