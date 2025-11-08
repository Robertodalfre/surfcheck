import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Plus, Waves, Settings } from "lucide-react";
import { useScheduling } from "@/hooks/useScheduling";
import { getSpots, SpotMeta } from "@/lib/api";
import SchedulingConfig from "@/components/SchedulingConfig";
import SchedulingCard from "@/components/SchedulingCard";
import NotificationTester from "@/components/NotificationTester";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { Scheduling } from "@/types/scheduling";
import { useToast } from "@/hooks/use-toast";

const getUserInitials = (displayName?: string | null) => {
  if (!displayName) return "U";
  return displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados para agendamentos
  const {
    schedulings,
    loading: schedulingLoading,
    error: schedulingError,
    createScheduling,
    updateScheduling,
    deleteScheduling,
    toggleScheduling
  } = useScheduling();
  
  // Estados da interface
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingScheduling, setEditingScheduling] = useState<Scheduling | null>(null);
  const [spots, setSpots] = useState<SpotMeta[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(true);

  // Carregar spots
  useEffect(() => {
    const loadSpots = async () => {
      try {
        const data = await getSpots();
        setSpots(data.spots || []);
      } catch (error) {
        console.error('Erro ao carregar spots:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os picos",
          variant: "destructive"
        });
      } finally {
        setSpotsLoading(false);
      }
    };
    
    loadSpots();
  }, [toast]);
  
  // Handlers para agendamentos
  const handleCreateScheduling = async (data: any) => {
    const result = await createScheduling(data);
    if (result) {
      setShowCreateForm(false);
      toast({
        title: "Sucesso!",
        description: `Agendamento criado para ${result.spot?.name}`
      });
    }
  };
  
  const handleToggleScheduling = async (id: string) => {
    const success = await toggleScheduling(id);
    if (success) {
      const scheduling = schedulings.find(s => s.id === id);
      toast({
        title: scheduling?.active ? "Pausado" : "Ativado",
        description: `Agendamento ${scheduling?.active ? 'pausado' : 'ativado'} com sucesso`
      });
    }
  };
  
  const handleDeleteScheduling = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
      const success = await deleteScheduling(id);
      if (success) {
        toast({
          title: "Removido",
          description: "Agendamento removido com sucesso"
        });
      }
    }
  };
  
  if (!user) {
    // Segurança extra: se cair aqui sem user, manda para login
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header do Perfil */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="h-20 w-20 ring-2 ring-ocean-primary/20">
                <AvatarImage src={user.photoURL || ""} alt={user.displayName || "Usuário"} />
                <AvatarFallback className="bg-ocean-primary/10 text-ocean-primary text-lg">
                  {getUserInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold text-foreground">
                  {user.displayName || "Usuário"}
                </h1>
                {user.email && (
                  <p className="text-muted-foreground mt-1">{user.email}</p>
                )}
                
                <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Waves className="h-3 w-3" />
                    {schedulings.filter(s => s.active).length} agendamentos ativos
                  </Badge>
                  <Badge variant="outline">
                    {schedulings.length} total
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Voltar ao início
                </Button>
                <Button variant="destructive" onClick={async () => {
                  await signOut();
                  navigate("/", { replace: true });
                }}>
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Agendamentos */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Waves className="h-5 w-5" />
                Meus Agendamentos
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Configure alertas personalizados para seus picos favoritos
              </p>
            </div>
            
            {!showCreateForm && !editingScheduling && (
              <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </Button>
            )}
          </div>

          {/* Formulário de Criação */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Criar Novo Agendamento</CardTitle>
              </CardHeader>
              <CardContent>
                {spotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-primary"></div>
                  </div>
                ) : (
                  <SchedulingConfig
                    spots={spots}
                    onSubmit={handleCreateScheduling}
                    onCancel={() => setShowCreateForm(false)}
                    loading={schedulingLoading}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Lista de Agendamentos */}
          {!showCreateForm && !editingScheduling && (
            <div className="space-y-4">
              {schedulingLoading && schedulings.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Carregando agendamentos...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : schedulings.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Waves className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhum agendamento ainda</h3>
                      <p className="text-muted-foreground mb-4">
                        Crie seu primeiro agendamento para receber alertas personalizados
                      </p>
                      <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Criar Agendamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {schedulings.map(scheduling => (
                    <SchedulingCard
                      key={scheduling.id}
                      scheduling={scheduling}
                      onToggle={handleToggleScheduling}
                      onEdit={setEditingScheduling}
                      onDelete={handleDeleteScheduling}
                      loading={schedulingLoading}
                    />
                  ))}
                </div>
              )}
              
              {schedulingError && (
                <Card className="border-destructive">
                  <CardContent className="pt-6">
                    <div className="text-center text-destructive">
                      <p className="font-medium">Erro ao carregar agendamentos</p>
                      <p className="text-sm mt-1">{schedulingError}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Seção de Testes de Notificação */}
        {schedulings.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                🔔 Teste de Notificações
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Teste o sistema de notificações e veja como funcionam os alertas
              </p>
            </div>
            
            <NotificationTester schedulings={schedulings} />
          </div>
        )}

        {/* Seção de Analytics */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              📊 Analytics & Histórico
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhe suas estatísticas, conquistas e recomendações personalizadas
            </p>
          </div>
          
          <AnalyticsDashboard />
        </div>
      </div>
    </div>
  );
};

export default Profile;
