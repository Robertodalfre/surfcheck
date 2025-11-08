import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  SchedulingPreferences, 
  NotificationSettings, 
  CreateSchedulingRequest,
  TimeWindow
} from '@/types/scheduling';
import { SpotMeta } from '@/lib/api';

interface SchedulingConfigProps {
  spots: SpotMeta[];
  onSubmit: (data: CreateSchedulingRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

const TIME_WINDOWS = [
  { id: 'morning' as TimeWindow, label: 'Manhã', icon: '🌅', hours: '05:00 – 09:00', description: 'Vento calmo, menos crowd' },
  { id: 'midday' as TimeWindow, label: 'Meio-dia', icon: '☀️', hours: '09:00 – 14:00', description: 'Luz boa, pode ter vento' },
  { id: 'afternoon' as TimeWindow, label: 'Tarde', icon: '🌇', hours: '14:00 – 18:00', description: 'Pós-trabalho, crowd moderado' },
  { id: 'evening' as TimeWindow, label: 'Final do dia', icon: '🌙', hours: '18:00 – 20:00', description: 'Luz dourada, vento diminui' }
];

const SURF_STYLES = [
  { id: 'longboard' as const, label: 'Longboard', description: 'Mar menor e limpo', icon: '🏄‍♂️' },
  { id: 'shortboard' as const, label: 'Shortboard', description: 'Mais força e tamanho', icon: '🏄' },
  { id: 'any' as const, label: 'Qualquer', description: 'Só quero surfar!', icon: '🤙' }
];

const WIND_PREFERENCES = [
  { id: 'offshore' as const, label: 'Offshore', description: 'Vento terral limpando', icon: '💨' },
  { id: 'light' as const, label: 'Vento fraco', description: 'Pouco vento, qualquer direção', icon: '🍃' },
  { id: 'any' as const, label: 'Qualquer vento', description: 'Não me importo com vento', icon: '🌪️' }
];

export default function SchedulingConfig({ spots, onSubmit, onCancel, loading = false }: SchedulingConfigProps) {
  const [selectedSpot, setSelectedSpot] = useState<string>('');
  const [daysAhead, setDaysAhead] = useState<1 | 3 | 5>(3);
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>(['morning', 'afternoon']);
  const [minScore, setMinScore] = useState<number>(70);
  const [surfStyle, setSurfStyle] = useState<'longboard' | 'shortboard' | 'any'>('any');
  const [windPreference, setWindPreference] = useState<'offshore' | 'light' | 'any'>('offshore');
  const [minEnergy, setMinEnergy] = useState<number>(3.0);
  
  // Configurações de notificação
  const [pushEnabled, setPushEnabled] = useState(true);
  const [advanceHours, setAdvanceHours] = useState(1);
  const [dailySummary, setDailySummary] = useState(true);
  const [specialAlerts, setSpecialAlerts] = useState(true);

  const selectedSpotData = spots.find(s => s.id === selectedSpot);

  const handleTimeWindowToggle = (windowId: TimeWindow) => {
    setTimeWindows(prev => {
      if (prev.includes(windowId)) {
        // Não permitir remover se for o último
        if (prev.length === 1) return prev;
        return prev.filter(w => w !== windowId);
      } else {
        return [...prev, windowId];
      }
    });
  };

  const handleSubmit = () => {
    if (!selectedSpot) return;

    const preferences: SchedulingPreferences = {
      days_ahead: daysAhead,
      time_windows: timeWindows,
      min_score: minScore,
      surf_style: surfStyle,
      wind_preference: windPreference,
      min_energy: minEnergy
    };

    const notifications: NotificationSettings = {
      push_enabled: pushEnabled,
      advance_hours: advanceHours,
      daily_summary: dailySummary,
      special_alerts: specialAlerts
    };

    onSubmit({
      spot_id: selectedSpot,
      preferences,
      notifications,
      active: true
    });
  };

  const isValid = selectedSpot && timeWindows.length > 0;

  return (
    <div className="space-y-6">
      {/* Seleção de Pico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏄‍♂️ Escolha seu Pico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedSpot} onValueChange={setSelectedSpot}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um pico para agendar" />
            </SelectTrigger>
            <SelectContent>
              {spots.map(spot => (
                <SelectItem key={spot.id} value={spot.id}>
                  {spot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedSpotData && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {selectedSpotData.localNotes}
              </p>
              {selectedSpotData.bestSwellDirections && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedSpotData.bestSwellDirections.map(dir => (
                    <Badge key={dir} variant="secondary" className="text-xs">
                      {dir}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Período de Interesse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📅 Período de Interesse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[1, 3, 5].map(days => (
              <Button
                key={days}
                variant={daysAhead === days ? "default" : "outline"}
                onClick={() => setDaysAhead(days as 1 | 3 | 5)}
                className="flex-1"
              >
                {days === 1 ? 'Hoje' : `${days} dias`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Janelas de Tempo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⏰ Janelas de Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {TIME_WINDOWS.map(window => (
              <div
                key={window.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  timeWindows.includes(window.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                }`}
                onClick={() => handleTimeWindowToggle(window.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{window.icon}</span>
                    <div>
                      <div className="font-medium">{window.label}</div>
                      <div className="text-sm text-muted-foreground">{window.hours}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{window.description}</div>
                    {timeWindows.includes(window.id) && (
                      <Badge variant="default" className="mt-1">Selecionado</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros de Qualidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎯 Filtros de Qualidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Mínimo */}
          <div>
            <Label className="flex items-center justify-between">
              Score Mínimo: <span className="font-mono">{minScore}</span>
            </Label>
            <Slider
              value={[minScore]}
              onValueChange={(value) => setMinScore(value[0])}
              max={100}
              min={0}
              step={5}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Qualquer (0)</span>
              <span>Perfeito (100)</span>
            </div>
          </div>

          {/* Estilo de Surf */}
          <div>
            <Label>Tipo de Mar Preferido</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {SURF_STYLES.map(style => (
                <Button
                  key={style.id}
                  variant={surfStyle === style.id ? "default" : "outline"}
                  onClick={() => setSurfStyle(style.id)}
                  className="justify-start h-auto p-3"
                >
                  <span className="mr-3 text-xl">{style.icon}</span>
                  <div className="text-left">
                    <div className="font-medium">{style.label}</div>
                    <div className="text-xs opacity-70">{style.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Preferência de Vento */}
          <div>
            <Label>Preferência de Vento</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {WIND_PREFERENCES.map(wind => (
                <Button
                  key={wind.id}
                  variant={windPreference === wind.id ? "default" : "outline"}
                  onClick={() => setWindPreference(wind.id)}
                  className="justify-start h-auto p-3"
                >
                  <span className="mr-3 text-xl">{wind.icon}</span>
                  <div className="text-left">
                    <div className="font-medium">{wind.label}</div>
                    <div className="text-xs opacity-70">{wind.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Energia Mínima */}
          <div>
            <Label className="flex items-center justify-between">
              Energia Mínima: <span className="font-mono">{minEnergy.toFixed(1)} kW/m</span>
            </Label>
            <Slider
              value={[minEnergy]}
              onValueChange={(value) => setMinEnergy(value[0])}
              max={10}
              min={1}
              step={0.5}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Fraco (1.0)</span>
              <span>Pesado (10.0)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔔 Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações Push</Label>
              <p className="text-sm text-muted-foreground">Receber alertas no dispositivo</p>
            </div>
            <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
          </div>

          {pushEnabled && (
            <>
              <div>
                <Label className="flex items-center justify-between">
                  Antecedência: <span className="font-mono">{advanceHours}h antes</span>
                </Label>
                <Slider
                  value={[advanceHours]}
                  onValueChange={(value) => setAdvanceHours(value[0])}
                  max={6}
                  min={1}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Resumo Diário</Label>
                  <p className="text-sm text-muted-foreground">Top 3 janelas do dia às 8h</p>
                </div>
                <Switch checked={dailySummary} onCheckedChange={setDailySummary} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Alertas Especiais</Label>
                  <p className="text-sm text-muted-foreground">Score &gt; 90 no seu pico</p>
                </div>
                <Switch checked={specialAlerts} onCheckedChange={setSpecialAlerts} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!isValid || loading}
          className="flex-1"
        >
          {loading ? 'Criando...' : 'Criar Agendamento'}
        </Button>
      </div>
    </div>
  );
}
