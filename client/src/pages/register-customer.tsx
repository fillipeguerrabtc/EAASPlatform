import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ShoppingBag, ArrowLeft } from "lucide-react";
import { SiGoogle, SiApple, SiGithub, SiX } from "react-icons/si";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterCustomerPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      return await apiRequest("POST", "/api/auth/register-customer", {
        name: data.name,
        email: data.email,
        password: data.password,
      });
    },
    onSuccess: () => {
      toast({
        title: "Conta criada!",
        description: "Bem-vindo à plataforma EAAS",
      });
      setLocation("/shop");
    },
    onError: (error: any) => {
      toast({
        title: "Erro no cadastro",
        description: error.message || "Não foi possível criar a conta",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `/api/auth/replit?provider=${provider}&type=customer`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-register-customer">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold" data-testid="text-customer-title">
                Cadastro de Cliente
              </CardTitle>
            </div>
          </div>
          <CardDescription data-testid="text-customer-description">
            Acesso imediato após criar sua conta
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-customer-name">Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Seu nome completo"
                        data-testid="input-customer-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-customer-email">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        data-testid="input-customer-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-customer-password">Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          data-testid="input-customer-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-customer-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-customer-confirm-password">Confirmar Senha</FormLabel>
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        data-testid="input-customer-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <div className="flex gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation("/register")}
                  data-testid="button-customer-back"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={registerMutation.isPending}
                  data-testid="button-customer-submit"
                >
                  {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Conta
                </Button>
              </div>

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
                  data-testid="button-customer-oauth-google"
                  className="hover-elevate active-elevate-2"
                >
                  <SiGoogle className="mr-2 h-4 w-4" />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthLogin("apple")}
                  data-testid="button-customer-oauth-apple"
                  className="hover-elevate active-elevate-2"
                >
                  <SiApple className="mr-2 h-4 w-4" />
                  Apple
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthLogin("github")}
                  data-testid="button-customer-oauth-github"
                  className="hover-elevate active-elevate-2"
                >
                  <SiGithub className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthLogin("twitter")}
                  data-testid="button-customer-oauth-twitter"
                  className="hover-elevate active-elevate-2"
                >
                  <SiX className="mr-2 h-4 w-4" />
                  X
                </Button>
              </div>

              <div className="text-sm text-center text-muted-foreground">
                Já tem uma conta?{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setLocation("/login")}
                  data-testid="button-customer-go-to-login"
                >
                  Entrar
                </button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
