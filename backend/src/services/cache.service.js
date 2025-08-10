import { LRUCache } from 'lru-cache';

const ttlMin = Number(process.env.CACHE_TTL_MIN || 20);
const cache = new LRUCache({ max: 500, ttl: ttlMin * 60 * 1000 });

export function getCache(key) {
  return cache.get(key);
}

export function setCache(key, value) {
  cache.set(key, value);
}
