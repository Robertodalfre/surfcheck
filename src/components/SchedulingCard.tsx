import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Scheduling } from '@/types/scheduling';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/lib/api';
import { MoreVertical, Edit, Trash2, MapPin, Clock, Target, Wind, Waves, TrendingUp } from 'lucide-react';

interface SchedulingCardProps {
  scheduling: Scheduling;
  onToggle: (id: string) => void;
  onEdit: (scheduling: Scheduling) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

const TIME_WINDOW_LABELS = {
  morning: { label: 'Manhã', icon: '🌅' },
  midday: { label: 'Meio-dia', icon: '☀️' },
  afternoon: { label: 'Tarde', icon: '🌇' },
  evening: { label: 'Final do dia', icon: '🌙' }
};

const SURF_STYLE_LABELS = {
  longboard: { label: 'Longboard', icon: '🏄‍♂️' },
  shortboard: { label: 'Shortboard', icon: '🏄' },
  any: { label: 'Qualquer', icon: '🤙' }
};

const WIND_PREFERENCE_LABELS = {
  offshore: { label: 'Offshore', icon: '💨' },
  light: { label: 'Vento fraco', icon: '🍃' },
  any: { label: 'Qualquer', icon: '🌪️' }
};

export default function SchedulingCard({ 
  scheduling, 
  onToggle, 
  onEdit, 
  onDelete, 
  loading = false 
}: SchedulingCardProps) {
  const { user } = useAuth();
  const [isToggling, setIsToggling] = useState(false);
  const [windowAnalysis, setWindowAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Carregar análise de janelas quando agendamento estiver ativo
  useEffect(() => {
    if (scheduling.active && !analysisLoading && !windowAnalysis) {
      loadWindowAnalysis();
    }
  }, [scheduling.active, scheduling.id]);

  const loadWindowAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const response = await fetch(`${API_URL}/scheduling/${scheduling.id}/preview`, {
        headers: {
          'x-user-id': user?.uid || 'anonymous'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWindowAnalysis(data.preview);
      }
    } catch (error) {
      console.error('Erro ao carregar análise:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggle(scheduling.id);
    setIsToggling(false);
    
    // Recarregar análise se foi ativado
    if (!scheduling.active) {
      setWindowAnalysis(null);
      loadWindowAnalysis();
    } else {
      setWindowAnalysis(null);
    }
  };

  const formatTimeWindows = () => {
    return scheduling.preferences.time_windows
      .map(window => TIME_WINDOW_LABELS[window]?.label || window)
      .join(', ');
  };

  const getStatusColor = () => {
    if (!scheduling.active) return 'bg-gray-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!scheduling.active) return 'Pausado';
    return 'Ativo';
  };

  return (
    <Card className={`transition-all duration-200 ${scheduling.active ? 'border-green-200' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg">
                {scheduling.spot?.name || `Pico ${scheduling.spot_id}`}
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className="text-sm text-muted-foreground">
                {getStatusText()}
              </span>
              <Badge variant="outline" className="text-xs">
                {scheduling.preferences.days_ahead === 1 ? 'Hoje' : `${scheduling.preferences.days_ahead} dias`}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={scheduling.active}
              onCheckedChange={handleToggle}
              disabled={isToggling || loading}
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(scheduling)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(scheduling.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Preferências Principais */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Horários:</span>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {formatTimeWindows()}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Score min:</span>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {scheduling.preferences.min_score}
            </p>
          </div>
        </div>

        {/* Estilo e Vento */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <span>{SURF_STYLE_LABELS[scheduling.preferences.surf_style]?.icon}</span>
            {SURF_STYLE_LABELS[scheduling.preferences.surf_style]?.label}
          </Badge>
          
          <Badge variant="secondary" className="flex items-center gap-1">
            <span>{WIND_PREFERENCE_LABELS[scheduling.preferences.wind_preference]?.icon}</span>
            {WIND_PREFERENCE_LABELS[scheduling.preferences.wind_preference]?.label}
          </Badge>
          
          <Badge variant="outline">
            {scheduling.preferences.min_energy.toFixed(1)} kW/m
          </Badge>
        </div>

        {/* Notificações */}
        {scheduling.notifications.push_enabled && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>🔔</span>
              <span>
                Alertas {scheduling.notifications.advance_hours}h antes
                {scheduling.notifications.daily_summary && ', resumo diário'}
                {scheduling.notifications.special_alerts && ', alertas especiais'}
              </span>
            </div>
          </div>
        )}

        {/* Informações do Pico */}
        {scheduling.spot && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              <p className="line-clamp-2">
                {scheduling.spot.localNotes}
              </p>
              {scheduling.spot.bestSwellDirections && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {scheduling.spot.bestSwellDirections.slice(0, 3).map(dir => (
                    <Badge key={dir} variant="outline" className="text-xs">
                      {dir}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Análise de Próximas Janelas */}
        {scheduling.active && (
          <div className="pt-2 border-t bg-muted/30 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
            {analysisLoading ? (
              <div className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-current"></div>
                  <span>Analisando próximas janelas...</span>
                </span>
              </div>
            ) : windowAnalysis ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Próximas Janelas
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {windowAnalysis.windows?.length || 0} encontradas
                  </Badge>
                </div>
                
                {windowAnalysis.windows && windowAnalysis.windows.length > 0 ? (
                  <div className="space-y-2">
                    {windowAnalysis.windows.slice(0, 2).map((window: any, index: number) => (
                      <div key={index} className="text-xs bg-background/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            {new Date(window.start).toLocaleDateString('pt-BR', { 
                              weekday: 'short', 
                              day: '2-digit', 
                              month: '2-digit' 
                            })} às {new Date(window.start).toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {window.quality_rating}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {window.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {Math.round(window.avg_score)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {window.duration_hours}h
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {windowAnalysis.windows.length > 2 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{windowAnalysis.windows.length - 2} janelas adicionais
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Waves className="h-3 w-3" />
                      <span>Nenhuma janela boa encontrada nos próximos {scheduling.preferences.days_ahead} dias</span>
                    </span>
                    <p className="mt-1">
                      Tente ajustar suas preferências para encontrar mais oportunidades
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  ❌ <span>Erro ao carregar análise</span>
                </span>
                <button 
                  onClick={loadWindowAnalysis}
                  className="text-xs underline ml-2 hover:no-underline"
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
