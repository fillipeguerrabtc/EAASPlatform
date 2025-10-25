import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, User, Bot, Send, UserCheck, AlertCircle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { useTranslation } from "react-i18next";

type Conversation = {
  id: string;
  tenantId: string;
  customerId: string;
  channel: string;
  status: string;
  assignedTo: string | null;
  isAiHandled: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderType: string;
  content: string;
  createdAt: string;
};

export default function OmnichatAdmin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Fetch all conversations with customer data
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const res = await fetch(`/api/messages?conversationId=${selectedConversation}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  // Takeover mutation (assign to current user, disable AI)
  const takeoverMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/takeover`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Controle assumido",
        description: "Você está agora controlando este chat. IA desativada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Release mutation (return to AI)
  const releaseMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/release`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Chat liberado",
        description: "IA voltou a controlar este chat.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send manual reply
  const sendReplyMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada via WhatsApp.",
      });
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversation] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendReply = () => {
    if (!selectedConversation || !replyMessage.trim()) return;
    sendReplyMutation.mutate({
      conversationId: selectedConversation,
      message: replyMessage.trim(),
    });
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  return (
    <>
      <SEO 
        title="Omnichat Admin - EAAS"
        description="Gerencie todos os chats do WhatsApp, assuma controle manual e monitore atendimentos da IA em tempo real"
      />
      
      <div className="container mx-auto p-6 space-y-6" data-testid="page-omnichat-admin">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Omnichat Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os chats, assuma controle e monitore atendimentos da IA
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Conversas Ativas
              </CardTitle>
              <CardDescription>
                {conversations.length} conversas no total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {loadingConversations ? (
                  <div className="text-center text-muted-foreground py-8">Carregando...</div>
                ) : conversations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhuma conversa ainda
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversations.map((conv) => (
                      <Card
                        key={conv.id}
                        className={`cursor-pointer transition-all ${
                          selectedConversation === conv.id
                            ? "border-primary shadow-md"
                            : "hover-elevate"
                        }`}
                        onClick={() => setSelectedConversation(conv.id)}
                        data-testid={`conversation-${conv.id}`}
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <SiWhatsapp className="h-4 w-4 text-[#25D366] flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate" data-testid={`customer-name-${conv.id}`}>
                                  {conv.customer?.name || "Cliente"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {conv.customer?.phone}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={conv.isAiHandled ? "default" : "secondary"}
                              className="flex-shrink-0"
                              data-testid={`handler-badge-${conv.id}`}
                            >
                              {conv.isAiHandled ? (
                                <><Bot className="h-3 w-3 mr-1" /> IA</>
                              ) : (
                                <><UserCheck className="h-3 w-3 mr-1" /> Humano</>
                              )}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {conv.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Detail */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedConv ? (
                      <>
                        <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
                        {selectedConv.customer?.name || "Cliente"}
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-5 w-5" />
                        Selecione uma conversa
                      </>
                    )}
                  </CardTitle>
                  {selectedConv && (
                    <CardDescription className="mt-1">
                      {selectedConv.customer?.phone} • {selectedConv.customer?.email}
                    </CardDescription>
                  )}
                </div>

                {selectedConv && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedConv.isAiHandled ? (
                      <Button
                        size="sm"
                        onClick={() => takeoverMutation.mutate(selectedConv.id)}
                        disabled={takeoverMutation.isPending}
                        data-testid="button-takeover"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Assumir Controle
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => releaseMutation.mutate(selectedConv.id)}
                        disabled={releaseMutation.isPending}
                        data-testid="button-release"
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        Liberar para IA
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedConversation ? (
                <div className="text-center text-muted-foreground py-16">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma conversa para ver o histórico</p>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <ScrollArea className="h-[400px] border rounded-lg p-4">
                    {loadingMessages ? (
                      <div className="text-center text-muted-foreground py-8">
                        Carregando mensagens...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem ainda
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${
                              msg.senderType === "customer" ? "justify-start" : "justify-end"
                            }`}
                            data-testid={`message-${msg.id}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                msg.senderType === "customer"
                                  ? "bg-muted"
                                  : msg.senderType === "ai"
                                  ? "bg-primary/10 border border-primary/20"
                                  : "bg-accent/10 border border-accent/20"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {msg.senderType === "customer" ? (
                                  <User className="h-3 w-3 text-muted-foreground" />
                                ) : msg.senderType === "ai" ? (
                                  <Bot className="h-3 w-3 text-primary" />
                                ) : (
                                  <UserCheck className="h-3 w-3 text-accent" />
                                )}
                                <span className="text-xs font-medium">
                                  {msg.senderType === "customer"
                                    ? "Cliente"
                                    : msg.senderType === "ai"
                                    ? "IA EAAS"
                                    : "Agente"}
                                </span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  <Separator />

                  {/* Reply Input */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Textarea
                        placeholder={
                          selectedConv?.isAiHandled
                            ? "Assuma o controle primeiro para enviar mensagens..."
                            : "Digite sua mensagem..."
                        }
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        disabled={selectedConv?.isAiHandled || sendReplyMutation.isPending}
                        className="min-h-[80px]"
                        data-testid="textarea-reply"
                      />
                      <Button
                        onClick={handleSendReply}
                        disabled={
                          selectedConv?.isAiHandled ||
                          !replyMessage.trim() ||
                          sendReplyMutation.isPending
                        }
                        data-testid="button-send-reply"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {selectedConv?.isAiHandled && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                        <AlertCircle className="h-4 w-4" />
                        <p>IA está controlando este chat. Assuma o controle para responder manualmente.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
