import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_URL } from '@/lib/api';
import { Bell, Send, BarChart3, Calendar, Zap } from 'lucide-react';

interface NotificationTesterProps {
  schedulings: any[];
}

export default function NotificationTester({ schedulings }: NotificationTesterProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testTitle, setTestTitle] = useState('🌊 Teste SurfCheck');
  const [testBody, setTestBody] = useState('Esta é uma notificação de teste do sistema de agendamentos!');
  const [stats, setStats] = useState<any>(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.uid || 'anonymous'
  });

  const sendTestNotification = async () => {
    if (!testTitle.trim() || !testBody.trim()) {
      toast({
        title: "Erro",
        description: "Título e mensagem são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications/test-send`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: testTitle,
          body: testBody,
          type: 'test'
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso!",
          description: "Notificação de teste enviada"
        });
      } else {
        throw new Error('Falha ao enviar');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao enviar notificação de teste",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDailySummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications/daily-summary`, {
        headers: getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          toast({
            title: data.summary.title,
            description: data.summary.body
          });
        } else {
          toast({
            title: "Info",
            description: data.message || "Nenhum resumo disponível"
          });
        }
      } else {
        throw new Error('Falha ao gerar resumo');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao gerar resumo diário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications/user-stats`, {
        headers: getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        throw new Error('Falha ao carregar estatísticas');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar estatísticas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const simulateWindow = async (schedulingId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications/simulate-window`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          scheduling_id: schedulingId,
          window_score: Math.floor(Math.random() * 30 + 70), // 70-100
          spot_name: 'Pico Simulado'
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Janela Simulada!",
          description: `Score ${data.simulated_window.avg_score} - ${data.simulated_window.description}`
        });
      } else {
        throw new Error('Falha ao simular janela');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao simular janela",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processAllNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications/process-all`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Processamento Concluído",
          description: `${data.total_processed} notificações processadas`
        });
      } else {
        throw new Error('Falha ao processar');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao processar notificações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Teste de Notificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notificação de Teste */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Enviar Notificação de Teste</Label>
          <div className="space-y-2">
            <Input
              placeholder="Título da notificação"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
            />
            <Textarea
              placeholder="Corpo da mensagem"
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              rows={2}
            />
            <Button 
              onClick={sendTestNotification}
              disabled={loading}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Enviando...' : 'Enviar Teste'}
            </Button>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 gap-3">
          <Button 
            variant="outline" 
            onClick={generateDailySummary}
            disabled={loading}
            className="justify-start"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Gerar Resumo Diário
          </Button>

          <Button 
            variant="outline" 
            onClick={loadUserStats}
            disabled={loading}
            className="justify-start"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Carregar Estatísticas
          </Button>

          <Button 
            variant="outline" 
            onClick={processAllNotifications}
            disabled={loading}
            className="justify-start"
          >
            <Bell className="h-4 w-4 mr-2" />
            Processar Todas Notificações
          </Button>
        </div>

        {/* Simular Janelas */}
        {schedulings.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Simular Janela Boa</Label>
            <div className="grid gap-2">
              {schedulings.slice(0, 3).map((scheduling) => (
                <Button
                  key={scheduling.id}
                  variant="outline"
                  size="sm"
                  onClick={() => simulateWindow(scheduling.id)}
                  disabled={loading}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="h-3 w-3" />
                    {scheduling.spot?.name || `Pico ${scheduling.spot_id}`}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Simular
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Estatísticas */}
        {stats && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Estatísticas do Usuário</Label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span>Agendamentos:</span>
                <Badge variant="outline">{stats.total_schedulings}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Ativos:</span>
                <Badge variant="secondary">{stats.active_schedulings}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Push habilitado:</span>
                <Badge variant="default">{stats.push_enabled}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Resumo diário:</span>
                <Badge variant="default">{stats.daily_summary_enabled}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Alertas especiais:</span>
                <Badge variant="default">{stats.special_alerts_enabled}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Antecedência média:</span>
                <Badge variant="outline">{stats.avg_advance_hours.toFixed(1)}h</Badge>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
          <p className="font-medium mb-1">ℹ️ Sistema de Notificações</p>
          <p>
            As notificações são simuladas no console do backend. 
            Em produção, seriam enviadas via Firebase Cloud Messaging.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
