import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

const LoginForm = () => {
  const { signIn, loading, user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Se o usuário já estiver autenticado, redireciona para a página inicial
    if (user) {
      navigate('/');
    } else {
      setIsLoading(false);
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    try {
      await signIn();
      // O redirecionamento será tratado pelo efeito acima
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      // Aqui você pode adicionar tratamento de erro mais sofisticado
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt:', { email, password });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo/Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-surface border border-border/50">
              <img src="/pwa-192x192.png" alt="SurfCheck" className="w-10 h-10 rounded-lg" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-ocean-primary">SurfCheck</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Sua sessão de surf te espera
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">

          {/* Login Button */}
          <Button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || isLoading}
            variant="outline"
            className="w-full py-6 px-4 flex items-center justify-center gap-3 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {(loading || isLoading) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {/* Logo do Google (SVG inline) */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.602 32.658 29.197 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.84 1.153 7.957 3.043l5.657-5.657C34.675 6.053 29.613 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.644 16.108 18.961 12 24 12c3.059 0 5.84 1.153 7.957 3.043l5.657-5.657C34.675 6.053 29.613 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.138 0 9.8-1.968 13.294-5.182l-6.131-5.188C29.132 35.091 26.671 36 24 36c-5.176 0-9.571-3.317-11.289-7.946l-6.5 5.005C9.533 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.012 2.908-3.154 5.208-5.84 6.63l-.001-.001 6.131 5.188C37.258 41.212 44 36 44 24 44 22.659 43.862 21.349 43.611 20.083z"/>
                </svg>
                <span>Entrar com Google</span>
              </>
            )}
          </Button>
        </form>

        {/* Footer Links */}
        <div className="text-center space-y-4">
          
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
