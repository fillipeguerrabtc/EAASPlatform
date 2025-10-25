import { Button } from "@/components/ui/button";
import { SiWhatsapp } from "react-icons/si";

export function WhatsAppWidget() {
  const handleWhatsAppClick = () => {
    // WhatsApp number format: Remove + and use international format
    const whatsappNumber = "14155238886"; // Twilio Sandbox number
    const message = encodeURIComponent(
      "Olá! Vim do marketplace EAAS e gostaria de conversar sobre produtos e serviços."
    );
    
    // Open WhatsApp with pre-filled message
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <Button
      variant="whatsapp"
      size="icon-lg"
      onClick={handleWhatsAppClick}
      className="fixed bottom-24 right-6 rounded-full shadow-lg z-40"
      data-testid="button-whatsapp-widget"
      title="Fale conosco no WhatsApp"
      aria-label="Abrir conversa no WhatsApp"
    >
      <SiWhatsapp className="h-6 w-6" data-testid="icon-whatsapp" />
    </Button>
  );
}
