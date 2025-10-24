import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Send, Sparkles, Facebook, Instagram, Plus } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, Message } from "@shared/schema";

const channelIcons = {
  web: MessageSquare,
  whatsapp: SiWhatsapp,
  facebook: Facebook,
  instagram: Instagram,
};

const channelColors = {
  web: "bg-blue-500",
  whatsapp: "bg-green-500",
  facebook: "bg-blue-600",
  instagram: "bg-pink-500",
};

export default function Omnichat() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });
  
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("/api/ai/chat", "POST", {
        message,
        conversationId: selectedConversation,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation, "messages"] });
      setNewMessage("");
      toast({
        title: "Message sent",
        description: "AI response received",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };
  
  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/whatsapp/send", "POST", {
        to: whatsappPhone,
        message: whatsappMessage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setWhatsappPhone("");
      setWhatsappMessage("");
      setWhatsappDialogOpen(false);
      toast({
        title: "WhatsApp message sent!",
        description: `Message sent to ${whatsappPhone} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "WhatsApp Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold" data-testid="text-omnichat-title">
            Omnichat
          </h1>
          <p className="text-muted-foreground mt-2">
            Unified communication center
          </p>
        </div>
        
        <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-whatsapp">
              <SiWhatsapp className="h-4 w-4" />
              Send WhatsApp
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send WhatsApp Message</DialogTitle>
              <DialogDescription>
                Send a message via WhatsApp (Twilio Sandbox)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+1234567890"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  data-testid="input-whatsapp-phone"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Include country code (e.g., +1 for US)
                </p>
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Input
                  id="message"
                  placeholder="Type your message..."
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  data-testid="input-whatsapp-message"
                />
              </div>
              <Button
                onClick={() => sendWhatsAppMutation.mutate()}
                disabled={sendWhatsAppMutation.isPending || !whatsappPhone || !whatsappMessage}
                className="w-full"
                data-testid="button-send-whatsapp"
              >
                {sendWhatsAppMutation.isPending ? "Sending..." : "Send WhatsApp Message"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="space-y-1 p-2">
                  {conversations.map((conv) => {
                    const Icon = channelIcons[conv.channel];
                    const colorClass = channelColors[conv.channel];
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full text-left p-3 rounded-md hover-elevate active-elevate-2 transition-colors ${
                          selectedConversation === conv.id ? "bg-accent" : ""
                        }`}
                        data-testid={`button-conversation-${conv.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${colorClass} text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                Customer #{conv.customerId?.slice(0, 8)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {conv.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {conv.isAiHandled ? "AI" : "Human"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="col-span-2 flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Messages</CardTitle>
              {selectedConversation && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Enabled
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 mb-4">
              {selectedConversation ? (
                messages && messages.length > 0 ? (
                  <div className="space-y-4 pr-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderType === "customer" ? "justify-start" : "justify-end"
                        }`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.senderType === "customer"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No messages in this conversation</p>
                  </div>
                )
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              )}
            </ScrollArea>
            
            {selectedConversation && (
              <div className="flex gap-2 flex-shrink-0">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending || !newMessage.trim()}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
