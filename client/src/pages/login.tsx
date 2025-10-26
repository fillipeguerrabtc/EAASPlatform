import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiGoogle, SiApple, SiGithub, SiX } from "react-icons/si";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao fazer login");
      }
      return await res.json();
    },
    onSuccess: async (response) => {
      // Invalidate cache to get fresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!",
      });
      
      // Use response data directly to determine redirect
      const user = response.user;
      
      if (!user) {
        // Fallback if no user data
        setLocation('/admin');
        return;
      }
      
      // Check approval status first
      if (user.approvalStatus === 'pending_approval') {
        toast({
          title: "Conta pendente",
          description: "Sua conta ainda está aguardando aprovação.",
          variant: "destructive",
        });
        setLocation('/login');
        return;
      }
      
      if (user.approvalStatus === 'rejected') {
        toast({
          title: "Conta rejeitada",
          description: "Sua solicitação de conta foi rejeitada.",
          variant: "destructive",
        });
        setLocation('/login');
        return;
      }
      
      // Redirect based on userType for approved users
      if (user.userType === 'customer') {
        setLocation('/shop');
      } else {
        // Employee or other types go to admin dashboard
        setLocation('/admin');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro no login",
        description: error.message || "Email ou senha inválidos",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  const handleOAuthLogin = (provider: string) => {
    // Redirect to Replit OAuth with employee type
    window.location.href = `/api/auth/replit?provider=${provider}&type=employee`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center" data-testid="text-login-title">
            Entrar
          </CardTitle>
          <CardDescription className="text-center" data-testid="text-login-description">
            Acesse sua conta no EAAS Platform
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" data-testid="label-password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setLocation("/forgot-password")}
                data-testid="button-forgot-password"
              >
                Esqueceu a senha?
              </button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            {/* Divider */}
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>

            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin("google")}
                data-testid="button-oauth-google"
                className="hover-elevate active-elevate-2"
              >
                <SiGoogle className="mr-2 h-4 w-4" />
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin("apple")}
                data-testid="button-oauth-apple"
                className="hover-elevate active-elevate-2"
              >
                <SiApple className="mr-2 h-4 w-4" />
                Apple
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin("github")}
                data-testid="button-oauth-github"
                className="hover-elevate active-elevate-2"
              >
                <SiGithub className="mr-2 h-4 w-4" />
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin("twitter")}
                data-testid="button-oauth-twitter"
                className="hover-elevate active-elevate-2"
              >
                <SiX className="mr-2 h-4 w-4" />
                X
              </Button>
            </div>

            <div className="text-sm text-center text-muted-foreground">
              Não tem uma conta?{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setLocation("/register")}
                data-testid="button-go-to-register"
              >
                Criar conta
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
