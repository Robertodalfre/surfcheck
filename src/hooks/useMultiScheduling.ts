import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SchedulingPreferences, NotificationSettings } from '@/types/scheduling';

export interface MultiScheduling {
  id: string;
  uid: string;
  region: string;
  regionName: string;
  spots: string[];
  active: boolean;
  preferences: SchedulingPreferences;
  notifications: NotificationSettings;
  created_at: string;
  updated_at: string;
  region_analysis?: {
    best_spot: string;
    best_window: any;
    spots_ranking: Array<{
      spot_id: string;
      spot_name: string;
      avg_score: number;
      peak_score: number;
      best_hour: any;
      window: any;
    }>;
    updated_at: string;
  };
}

export interface CreateMultiSchedulingRequest {
  region: string;
  spots?: string[];
  preferences?: Partial<SchedulingPreferences>;
  notifications?: Partial<NotificationSettings>;
  active?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useMultiScheduling() {
  const [multiSchedulings, setMultiSchedulings] = useState<MultiScheduling[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.uid || ''
  });

  // Carregar agendamentos multi-pico
  const loadMultiSchedulings = async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/multi-scheduling`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMultiSchedulings(data.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar agendamentos';
      setError(message);
      console.error('Erro ao carregar agendamentos multi-pico:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMultiSchedulings();
  }, [user?.uid]);

  // Criar agendamento multi-pico
  const createMultiScheduling = async (data: CreateMultiSchedulingRequest): Promise<MultiScheduling | null> => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/multi-scheduling`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      const newMultiScheduling = await response.json();
      setMultiSchedulings(prev => [...prev, newMultiScheduling]);
      
      return newMultiScheduling;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar agendamento';
      setError(message);
      console.error('Erro ao criar agendamento multi-pico:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Atualizar agendamento multi-pico
  const updateMultiScheduling = async (id: string, updates: Partial<MultiScheduling>): Promise<MultiScheduling | null> => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/multi-scheduling/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      const updatedMultiScheduling = await response.json();
      setMultiSchedulings(prev => 
        prev.map(ms => ms.id === id ? updatedMultiScheduling : ms)
      );
      
      return updatedMultiScheduling;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar agendamento';
      setError(message);
      console.error('Erro ao atualizar agendamento multi-pico:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Deletar agendamento multi-pico
  const deleteMultiScheduling = async (id: string): Promise<boolean> => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/multi-scheduling/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      setMultiSchedulings(prev => prev.filter(ms => ms.id !== id));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar agendamento';
      setError(message);
      console.error('Erro ao deletar agendamento multi-pico:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Toggle ativo/inativo
  const toggleMultiScheduling = async (id: string): Promise<boolean> => {
    const current = multiSchedulings.find(ms => ms.id === id);
    if (!current) return false;

    const updated = await updateMultiScheduling(id, { active: !current.active });
    return !!updated;
  };

  return {
    multiSchedulings,
    loading,
    error,
    createMultiScheduling,
    updateMultiScheduling,
    deleteMultiScheduling,
    toggleMultiScheduling,
    loadMultiSchedulings
  };
}
