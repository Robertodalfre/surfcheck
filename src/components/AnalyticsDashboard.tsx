import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_URL } from '@/lib/api';
import { 
  BarChart3, 
  Trophy, 
  TrendingUp, 
  Users, 
  Target, 
  Calendar,
  Award,
  Lightbulb,
  RefreshCw
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.uid || 'anonymous'
  });

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/analytics/dashboard`, {
        headers: getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
        setBadges(data.badges);
      } else {
        throw new Error('Falha ao carregar dashboard');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/analytics/matches`, {
        headers: getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Erro ao carregar matches:', error);
    }
  };

  const seedTestData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/analytics/seed-data`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: "Dados de teste criados"
        });
        await loadDashboard();
      } else {
        throw new Error('Falha ao criar dados de teste');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar dados de teste",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadMatches();
  }, []);

  const getBadgeRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'uncommon': return 'bg-green-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && !analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum dado ainda</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie alguns agendamentos e comece a surfar para ver suas estatísticas
          </p>
          <Button onClick={seedTestData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Criar Dados de Teste
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sessões</p>
                <p className="text-2xl font-bold">{analytics.summary.windows_surfed}</p>
              </div>
              <Target className="h-8 w-8 text-ocean-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa</p>
                <p className="text-2xl font-bold">{analytics.summary.surf_rate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Médio</p>
                <p className="text-2xl font-bold">{analytics.summary.avg_surfed_score}</p>
              </div>
              <Award className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Badges</p>
                <p className="text-2xl font-bold">{badges.length}</p>
              </div>
              <Trophy className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Badges/Conquistas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {badges.length > 0 ? (
              <div className="space-y-3">
                {badges.slice(0, 5).map((badge, index) => (
                  <div key={badge.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${getBadgeRarityColor(badge.rarity)}`}>
                      <span className="text-lg">{badge.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {badge.rarity}
                    </Badge>
                  </div>
                ))}
                {badges.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{badges.length - 5} conquistas adicionais
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma conquista ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recomendações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.recommendations.length > 0 ? (
              <div className="space-y-3">
                {analytics.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{rec.title}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(rec.confidence * 100)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma recomendação disponível</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Picos Favoritos e Horários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Picos Favoritos</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.preferences.top_spots.length > 0 ? (
              <div className="space-y-2">
                {analytics.preferences.top_spots.slice(0, 5).map((spot: any, index: number) => (
                  <div key={spot.spot_id} className="flex items-center justify-between">
                    <span className="font-medium">{spot.spot_id}</span>
                    <Badge variant="outline">{spot.count} sessões</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhum pico surfado ainda
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horários Preferidos</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.preferences.time_preferences).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(analytics.preferences.time_preferences).map(([time, count]: [string, any]) => {
                  const numCount = Number(count);
                  const maxCount = Math.max(...Object.values(analytics.preferences.time_preferences).map((v: any) => Number(v)));
                  const percentage = maxCount > 0 ? (numCount / maxCount) * 100 : 0;
                  
                  return (
                    <div key={time} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{time}</span>
                        <span>{numCount} sessões</span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhum padrão de horário ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sistema de Match */}
      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Surfistas Compatíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.slice(0, 4).map((match: any) => (
                <div key={match.uid} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{match.name}</span>
                    <Badge variant="secondary">
                      {match.compatibility_score}% match
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {match.common_spots.length > 0 && (
                      <p>Picos: {match.common_spots.join(', ')}</p>
                    )}
                    {match.match_reasons.slice(0, 2).map((reason: string, i: number) => (
                      <p key={i}>• {reason}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <Button onClick={loadDashboard} disabled={loading} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
        {/* <Button onClick={seedTestData} disabled={loading} variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Dados de Teste
        </Button> */}
      </div>
    </div>
  );
}
