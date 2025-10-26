import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, ShoppingBag } from "lucide-react";

export default function RegisterPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl" data-testid="card-register-choose">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold" data-testid="text-choose-title">
            Criar Conta
          </CardTitle>
          <CardDescription data-testid="text-choose-description">
            Escolha o tipo de conta que deseja criar
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Employee Option */}
          <button
            onClick={() => setLocation("/register/employee")}
            className="group p-8 border-2 border-border rounded-xl hover-elevate active-elevate-2 transition-all flex flex-col items-center gap-4 text-center"
            data-testid="button-choose-employee"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <UserCircle className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Sou Funcionário</h3>
              <p className="text-sm text-muted-foreground">
                Acesso à plataforma após aprovação do administrador
              </p>
            </div>
          </button>

          {/* Customer Option */}
          <button
            onClick={() => setLocation("/register/customer")}
            className="group p-8 border-2 border-border rounded-xl hover-elevate active-elevate-2 transition-all flex flex-col items-center gap-4 text-center"
            data-testid="button-choose-customer"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <ShoppingBag className="w-12 h-12 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Sou Cliente</h3>
              <p className="text-sm text-muted-foreground">
                Acesso imediato à área de compras e serviços
              </p>
            </div>
          </button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-sm text-center text-muted-foreground">
            Já tem uma conta?{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setLocation("/login")}
              data-testid="button-go-to-login"
            >
              Entrar
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
