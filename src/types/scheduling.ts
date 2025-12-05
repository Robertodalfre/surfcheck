// Tipos para o sistema de agendamentos

export interface SchedulingPreferences {
  days_ahead: 1 | 3 | 5;
  time_windows: TimeWindow[];
  min_score: number; // 0-100
  surf_style: 'longboard' | 'shortboard' | 'any';
  wind_preference: 'offshore' | 'light' | 'any';
  min_energy: number; // kW/m
}

export interface NotificationSettings {
  push_enabled: boolean;
  advance_hours: number; // horas de antecedência
  daily_summary: boolean; // resumo diário às 8h
  special_alerts: boolean; // alertas para score > 90
  fixed_time?: string | null; // HH:mm
  timezone?: string; // IANA timezone, ex: 'America/Sao_Paulo'
}

// Estrutura para armazenar dados do forecast do próximo dia
export interface NextDayForecast {
  best_window: {
    time: string; // "07:00"
    date: string; // "2024-11-11"
    score: number; // 85
    swell_height: number; // 1.8
    swell_direction: number; // 135 (graus)
    swell_direction_text: string; // "SE"
    swell_period: number; // 12
    wind_speed: number; // 15
    wind_direction: number; // 225 (graus)
    energy_joules: number; // 4.2
    power_kwm: number; // 4.2
    conditions_summary: string; // "boas condições de manhã"
  };
  updated_at: string; // ISO timestamp
}

export interface Scheduling {
  id: string;
  uid: string;
  spot_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  preferences: SchedulingPreferences;
  notifications: NotificationSettings;
  next_day_forecast?: NextDayForecast; // Dados do melhor horário do próximo dia
  spot?: Spot; // Dados do pico (quando enriquecido)
}

export type TimeWindow = 'morning' | 'midday' | 'afternoon';

export interface TimeWindowConfig {
  id: TimeWindow;
  label: string;
  icon: string;
  hours: string;
  description: string;
}

export interface SurfStyleConfig {
  id: 'longboard' | 'shortboard' | 'any';
  label: string;
  description: string;
  icon: string;
}

export interface WindPreferenceConfig {
  id: 'offshore' | 'light' | 'any';
  label: string;
  description: string;
  icon: string;
}

// Dados do pico (reutilizando do sistema existente)
export interface Spot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  beachAzimuth: number;
  swellWindow: [number, number];
  windShelter: {
    offshore: [number, number];
    badOnshore: [number, number];
  };
  bottomType: string;
  tidePreference: string[];
  bestSwellDirections: string[];
  idealPeriodRange: [number, number];
  minSwellHeight: number;
  windTolerance: {
    offshoreMax: number;
    onshoreMax: number;
  };
  hazards: string[];
  suitableLevels: string[];
  amenities: string[];
  crowdLevel: number;
  localNotes: string;
}

// Resposta da API
export interface SchedulingResponse {
  schedulings: Scheduling[];
  total: number;
}

export interface CreateSchedulingRequest {
  spot_id: string;
  preferences?: Partial<SchedulingPreferences>;
  notifications?: Partial<NotificationSettings>;
  active?: boolean;
}

export interface UpdateSchedulingRequest {
  preferences?: Partial<SchedulingPreferences>;
  notifications?: Partial<NotificationSettings>;
  active?: boolean;
}

// Preview de janelas (será implementado na Etapa 3)
export interface WindowPreview {
  scheduling_id: string;
  spot: Spot;
  preferences: SchedulingPreferences;
  next_windows: any[]; // Será definido na Etapa 3
  last_updated: string;
}
