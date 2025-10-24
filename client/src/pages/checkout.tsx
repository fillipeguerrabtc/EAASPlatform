import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  
  // Check URL params for success/cancel from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setPaymentSuccess(true);
      toast({
        title: "Payment Successful!",
        description: "Your payment was processed successfully (Test Mode)",
      });
    } else if (params.get("canceled") === "true") {
      toast({
        title: "Payment Canceled",
        description: "You can try again when ready",
        variant: "destructive",
      });
    }
  }, [location]);

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/create-payment-intent", "POST", {
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
          title: "Error",
          description: "Could not create checkout session",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
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
            <CardTitle className="text-center">Payment Successful!</CardTitle>
            <CardDescription className="text-center">
              Your payment of ${amount} has been processed (Test Mode)
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
              Make Another Payment
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
          Checkout
        </h1>
        <p className="text-muted-foreground mt-2">
          Stripe Payment Integration (Test Mode)
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </CardTitle>
            <CardDescription>
              Enter payment amount and description
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
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
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Payment description"
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
                  <>Processing...</>
                ) : (
                  <>Create Payment Intent</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                🧪 Test mode - No real charges will be made
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
