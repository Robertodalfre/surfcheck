import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, MapPin, Clock, Target, Wind } from 'lucide-react';
import { MultiScheduling } from '@/hooks/useMultiScheduling';

interface MultiSchedulingCardProps {
  multiScheduling: MultiScheduling;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

const REGION_ICONS: Record<string, string> = {
  ubatuba: '🏖️',
  sao_sebastiao: '🌊',
  florianopolis: '🏄‍♂️',
  rio_de_janeiro: '🏙️'
};

export default function MultiSchedulingCard({ 
  multiScheduling, 
  onToggle, 
  onDelete, 
  loading = false 
}: MultiSchedulingCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const formatTimeWindows = (windows: string[]) => {
    const labels: Record<string, string> = {
      morning: 'Manhã',
      midday: 'Meio-dia',
      afternoon: 'Tarde',
      evening: 'Noite'
    };
    return windows.map(w => labels[w] || w).join(', ');
  };

  const formatSurfStyle = (style: string) => {
    const labels: Record<string, string> = {
      longboard: 'Longboard',
      shortboard: 'Shortboard',
      any: 'Qualquer'
    };
    return labels[style] || style;
  };

  const formatWindPreference = (wind: string) => {
    const labels: Record<string, string> = {
      offshore: 'Offshore',
      light: 'Vento fraco',
      any: 'Qualquer'
    };
    return labels[wind] || wind;
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50/50 to-cyan-50/50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{REGION_ICONS[multiScheduling.region] || '🗺️'}</span>
            <div>
              <CardTitle className="text-lg">{multiScheduling.regionName}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {multiScheduling.spots.length} picos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Notificações 2x/dia
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={multiScheduling.active ? "default" : "secondary"}>
              {multiScheduling.active ? "Ativo" : "Inativo"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggle(multiScheduling.id)}
              disabled={loading}
            >
              {multiScheduling.active ? "Pausar" : "Ativar"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(multiScheduling.id)}
              disabled={loading}
            >
              Excluir
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Resumo das preferências */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className="text-xs">
            <Target className="h-3 w-3 mr-1" />
            Score ≥ {multiScheduling.preferences.min_score}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Wind className="h-3 w-3 mr-1" />
            {formatWindPreference(multiScheduling.preferences.wind_preference)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            🏄‍♂️ {formatSurfStyle(multiScheduling.preferences.surf_style)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            ⏰ {formatTimeWindows(multiScheduling.preferences.time_windows)}
          </Badge>
        </div>

        {/* Ranking dos spots (se disponível) */}
        {multiScheduling.region_analysis?.spots_ranking && (
          <div className="mb-3 p-3 bg-white/60 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">🏆 Ranking Atual (Top 3)</h4>
              <span className="text-xs text-muted-foreground">
                Atualizado: {new Date(multiScheduling.region_analysis.updated_at).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="space-y-1">
              {multiScheduling.region_analysis.spots_ranking.slice(0, 3).map((spot, index) => (
                <div key={spot.spot_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium">{spot.spot_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Score {Math.round(spot.avg_score)}
                    </Badge>
                    {spot.best_hour?.time && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(spot.best_hour.time).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão para mostrar/ocultar detalhes */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full justify-center text-xs"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Ocultar detalhes
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Ver detalhes
            </>
          )}
        </Button>

        {/* Detalhes expandidos */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">📍 Picos Monitorados</h4>
              <div className="text-xs text-muted-foreground">
                {multiScheduling.spots.length} picos selecionados na região
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">🎯 Filtros de Qualidade</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Score mínimo: {multiScheduling.preferences.min_score}</div>
                <div>Energia mínima: {multiScheduling.preferences.min_energy} kW/m</div>
                <div>Estilo: {formatSurfStyle(multiScheduling.preferences.surf_style)}</div>
                <div>Vento: {formatWindPreference(multiScheduling.preferences.wind_preference)}</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">🔔 Notificações</h4>
              <div className="text-xs space-y-1">
                <div>• Comparações regionais: 06:00 e 18:00</div>
                {multiScheduling.notifications.daily_summary && (
                  <div>• Resumo diário habilitado</div>
                )}
                {multiScheduling.notifications.special_alerts && (
                  <div>• Alertas especiais (score &gt; 90)</div>
                )}
                {multiScheduling.notifications.fixed_time && (
                  <div>• Horário fixo: {multiScheduling.notifications.fixed_time}</div>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Criado em: {new Date(multiScheduling.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
