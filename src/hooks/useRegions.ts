import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface Region {
  id: string;
  name: string;
}

export interface RegionSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region?: string;
  regionName?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.uid || ''
  });

  useEffect(() => {
    const fetchRegions = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const response = await fetch(`${API_BASE}/regions`, {
          headers: getHeaders()
        });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setRegions(data.regions || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar regiões';
        setError(message);
        console.error('Erro ao carregar regiões:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, [user?.uid]);

  const getRegionSpots = useCallback(async (regionId: string): Promise<RegionSpot[]> => {
    if (!user?.uid) return [];

    try {
      const response = await fetch(`${API_BASE}/regions/${regionId}/spots`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.spots || [];
    } catch (err) {
      console.error('Erro ao carregar spots da região:', err);
      return [];
    }
  }, [user?.uid]);

  return {
    regions,
    loading,
    error,
    getRegionSpots
  };
}
