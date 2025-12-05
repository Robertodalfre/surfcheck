export const to360 = (d) => ((d % 360) + 360) % 360;
export const to180 = (d) => ((d + 540) % 360) - 180;
export const angDiff = (a, b) => Math.abs(to180(a - b));

export const inSector = (dir, [lo, hi]) => {
  const d = to360(dir), L = to360(lo), H = to360(hi);
  return L <= H ? (d >= L && d <= H) : (d >= L || d <= H);
};

/**
 * Converte direção numérica (0-360°) para texto surfístico
 * @param {number} degrees - Direção em graus (0-360)
 * @returns {string} Direção em texto (ex: "S-SSE", "NE", "W")
 */
export const directionToText = (degrees) => {
  if (degrees == null || !Number.isFinite(degrees)) return 'N/A';
  
  const normalized = to360(degrees);
  
  // Definir os 16 pontos cardeais com suas faixas
  const directions = [
    { min: 348.75, max: 360, text: 'N' },
    { min: 0, max: 11.25, text: 'N' },
    { min: 11.25, max: 33.75, text: 'NNE' },
    { min: 33.75, max: 56.25, text: 'NE' },
    { min: 56.25, max: 78.75, text: 'ENE' },
    { min: 78.75, max: 101.25, text: 'E' },
    { min: 101.25, max: 123.75, text: 'ESE' },
    { min: 123.75, max: 146.25, text: 'SE' },
    { min: 146.25, max: 168.75, text: 'SSE' },
    { min: 168.75, max: 191.25, text: 'S' },
    { min: 191.25, max: 213.75, text: 'SSW' },
    { min: 213.75, max: 236.25, text: 'SW' },
    { min: 236.25, max: 258.75, text: 'WSW' },
    { min: 258.75, max: 281.25, text: 'W' },
    { min: 281.25, max: 303.75, text: 'WNW' },
    { min: 303.75, max: 326.25, text: 'NW' },
    { min: 326.25, max: 348.75, text: 'NNW' }
  ];
  
  // Encontrar a direção correspondente
  for (const dir of directions) {
    if (normalized >= dir.min && normalized < dir.max) {
      return dir.text;
    }
  }
  
  return 'N'; // fallback
};
