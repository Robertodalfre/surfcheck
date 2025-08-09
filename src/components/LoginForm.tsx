
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Waves } from 'lucide-react';

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
              <Waves className="w-8 h-8 text-ocean-primary animate-wave" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-ocean-primary">WaveMood</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Sua sessão de surf te espera
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-surface border-border/50 text-foreground placeholder:text-muted-foreground focus:border-ocean-primary focus:ring-ocean-primary"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-surface border-border/50 text-foreground placeholder:text-muted-foreground focus:border-ocean-primary focus:ring-ocean-primary"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-ocean-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            className="w-full ocean-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Entrar na sessão
          </Button>
        </form>

        {/* Footer Links */}
        <div className="text-center space-y-4">
          <button className="text-ocean-primary text-sm hover:underline">
            Esqueceu a senha?
          </button>
          
          <div className="text-muted-foreground text-sm">
            Novo no WaveMood?{' '}
            <button className="text-ocean-primary hover:underline font-medium">
              Criar conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
