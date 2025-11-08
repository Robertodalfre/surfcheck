import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/lib/api';
import { 
  Scheduling, 
  SchedulingResponse, 
  CreateSchedulingRequest, 
  UpdateSchedulingRequest 
} from '@/types/scheduling';

const API_BASE = `${API_URL}/scheduling`;

interface UseSchedulingReturn {
  schedulings: Scheduling[];
  loading: boolean;
  error: string | null;
  createScheduling: (data: CreateSchedulingRequest) => Promise<Scheduling | null>;
  updateScheduling: (id: string, data: UpdateSchedulingRequest) => Promise<Scheduling | null>;
  deleteScheduling: (id: string) => Promise<boolean>;
  toggleScheduling: (id: string) => Promise<boolean>;
  refreshSchedulings: () => Promise<void>;
}

export function useScheduling(): UseSchedulingReturn {
  const { user } = useAuth();
  const [schedulings, setSchedulings] = useState<Scheduling[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Headers para autenticação
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.uid || 'anonymous'
  });

  // Buscar agendamentos
  const fetchSchedulings = async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_BASE, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data: SchedulingResponse = await response.json();
      setSchedulings(data.schedulings || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('Erro ao buscar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Criar agendamento
  const createScheduling = async (data: CreateSchedulingRequest): Promise<Scheduling | null> => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return null;
    }

    setError(null);

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      const result = await response.json();
      const newScheduling = result.scheduling;

      // Atualizar lista local
      setSchedulings(prev => [...prev, newScheduling]);
      
      return newScheduling;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar agendamento';
      setError(message);
      console.error('Erro ao criar agendamento:', err);
      return null;
    }
  };

  // Atualizar agendamento
  const updateScheduling = async (id: string, data: UpdateSchedulingRequest): Promise<Scheduling | null> => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return null;
    }

    setError(null);

    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      const result = await response.json();
      const updatedScheduling = result.scheduling;

      // Atualizar lista local
      setSchedulings(prev => 
        prev.map(s => s.id === id ? updatedScheduling : s)
      );

      return updatedScheduling;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar agendamento';
      setError(message);
      console.error('Erro ao atualizar agendamento:', err);
      return null;
    }
  };

  // Remover agendamento
  const deleteScheduling = async (id: string): Promise<boolean> => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return false;
    }

    setError(null);

    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      // Remover da lista local
      setSchedulings(prev => prev.filter(s => s.id !== id));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover agendamento';
      setError(message);
      console.error('Erro ao remover agendamento:', err);
      return false;
    }
  };

  // Toggle ativo/inativo
  const toggleScheduling = async (id: string): Promise<boolean> => {
    const scheduling = schedulings.find(s => s.id === id);
    if (!scheduling) return false;

    const updated = await updateScheduling(id, { 
      active: !scheduling.active 
    });

    return updated !== null;
  };

  // Refresh manual
  const refreshSchedulings = async () => {
    await fetchSchedulings();
  };

  // Buscar agendamentos quando usuário muda
  useEffect(() => {
    if (user?.uid) {
      fetchSchedulings();
    } else {
      setSchedulings([]);
      setError(null);
    }
  }, [user?.uid]);

  return {
    schedulings,
    loading,
    error,
    createScheduling,
    updateScheduling,
    deleteScheduling,
    toggleScheduling,
    refreshSchedulings
  };
}
