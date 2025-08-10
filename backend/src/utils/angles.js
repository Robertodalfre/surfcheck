export const to360 = (d) => ((d % 360) + 360) % 360;
export const to180 = (d) => ((d + 540) % 360) - 180;
export const angDiff = (a, b) => Math.abs(to180(a - b));

export const inSector = (dir, [lo, hi]) => {
  const d = to360(dir), L = to360(lo), H = to360(hi);
  return L <= H ? (d >= L && d <= H) : (d >= L || d <= H);
};
