import type { ThemeTokens } from "@/types/brandScanner";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface BuyButtonProps {
  tokens: ThemeTokens;
  productId?: string;
  productName?: string;
  price?: number;
  currency?: string;
  onAddToCart?: () => Promise<void>;
  disabled?: boolean;
  variant?: "default" | "outline";
}

export function BuyButton({
  tokens,
  productId,
  productName = "Product",
  price,
  currency = "USD",
  onAddToCart,
  disabled = false,
  variant = "default",
}: BuyButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const handleClick = async () => {
    if (!onAddToCart) return;

    setIsLoading(true);
    try {
      await onAddToCart();
      setIsAdded(true);
      
      // Reset "added" state after 2 seconds
      setTimeout(() => {
        setIsAdded(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonStyle =
    variant === "default"
      ? {
          backgroundColor: tokens.primary.hex,
          color: tokens.background.hex,
        }
      : {
          borderColor: tokens.primary.hex,
          color: tokens.primary.hex,
        };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  };

  return (
    <Button
      data-testid="button-buy-product"
      style={buttonStyle}
      variant={variant}
      size="lg"
      onClick={handleClick}
      disabled={disabled || isLoading || isAdded}
      className="w-full sm:w-auto"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Adding...
        </>
      ) : isAdded ? (
        <>
          <Check className="mr-2 h-5 w-5" />
          Added to Cart
        </>
      ) : (
        <>
          <ShoppingCart className="mr-2 h-5 w-5" />
          {price !== undefined ? (
            <span data-testid="button-price-label">
              Add to Cart - {formatPrice(price)}
            </span>
          ) : (
            "Add to Cart"
          )}
        </>
      )}
    </Button>
  );
}
