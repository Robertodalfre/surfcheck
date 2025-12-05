import { useState, useEffect } from 'react';
import { getSpots, SpotMeta } from '@/lib/api';

// Re-export SpotMeta for convenience
export type { SpotMeta };

export function useSpots() {
  const [spots, setSpots] = useState<SpotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpots = async () => {
      try {
        setError(null);
        const data = await getSpots();
        setSpots(data.spots || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar spots';
        setError(message);
        console.error('Erro ao carregar spots:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSpots();
  }, []);

  return {
    spots,
    loading,
    error
  };
}
