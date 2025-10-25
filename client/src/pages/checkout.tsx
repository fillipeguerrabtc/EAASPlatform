import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, CheckCircle2 } from "lucide-react";

export default function Checkout() {
  const [amount, setAmount] = useState("100");
  const [description, setDescription] = useState("EAAS Platform Service");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Check URL params for success/cancel from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setPaymentSuccess(true);
      toast({
        title: t('checkout.paymentSuccessful'),
        description: t('checkout.paymentSuccessDesc'),
      });
    } else if (params.get("canceled") === "true") {
      toast({
        title: t('checkout.paymentCanceled'),
        description: t('checkout.tryAgain'),
        variant: "destructive",
      });
    }
  }, [location, toast, t]);

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        amount: parseFloat(amount),
        description,
      });
      return response;
    },
    onSuccess: (data: any) => {
      console.log("Stripe Checkout Session created:", data.url);
      
      // Redirect to Stripe hosted checkout page
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: t('common.error'),
          description: t('checkout.sessionError'),
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('checkout.paymentFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) <= 0) {
      toast({
        title: t('checkout.invalidAmount'),
        description: t('checkout.validAmount'),
        variant: "destructive",
      });
      return;
    }
    createPaymentMutation.mutate();
  };

  if (paymentSuccess) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-center">{t('checkout.paymentSuccessful')}</CardTitle>
            <CardDescription className="text-center">
              {t('checkout.paymentProcessed')} R$ {amount} ({t('checkout.testMode')})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => {
                setPaymentSuccess(false);
                setAmount("100");
                setDescription("EAAS Platform Service");
              }}
              className="w-full"
              data-testid="button-new-payment"
            >
              {t('checkout.makeAnotherPayment')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold" data-testid="text-checkout-title">
          {t('checkout.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('checkout.subtitle')}
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('checkout.paymentDetails')}
            </CardTitle>
            <CardDescription>
              {t('checkout.enterDetails')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t('checkout.amount')}</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  disabled={createPaymentMutation.isPending}
                  data-testid="input-payment-amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('common.description')}</Label>
                <Input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('checkout.descriptionPlaceholder')}
                  disabled={createPaymentMutation.isPending}
                  data-testid="input-payment-description"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createPaymentMutation.isPending}
                data-testid="button-create-payment"
              >
                {createPaymentMutation.isPending ? (
                  <>{t('common.processing')}</>
                ) : (
                  <>{t('checkout.createPayment')}</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                {t('checkout.testModeNote')}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
