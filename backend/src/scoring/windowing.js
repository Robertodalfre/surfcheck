export function groupGoodWindows(hours, threshold = 60) {
  // hours: [{ time, score, label, reasons, scores }]
  const windows = [];
  let start = null;
  let buf = [];
  const flush = () => {
    if (buf.length === 0) return;
    const scoreAvg = Math.round(buf.reduce((p, c) => p + c.score, 0) / buf.length);
    const reasons = summarizeReasons(buf);
    windows.push({
      start: buf[0].time,
      end: buf[buf.length - 1].time,
      score_avg: scoreAvg,
      highlights: reasons,
      count: buf.length,
    });
    buf = [];
  };

  for (const h of hours) {
    if ((h.score ?? 0) >= threshold) {
      buf.push(h);
    } else {
      flush();
    }
  }
  flush();
  return windows;
}

function summarizeReasons(arr) {
  const freq = new Map();
  for (const h of arr) {
    for (const r of h.reasons || []) {
      freq.set(r, (freq.get(r) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}
