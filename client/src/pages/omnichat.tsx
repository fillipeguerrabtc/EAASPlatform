import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, Facebook, Instagram } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
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

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold" data-testid="text-omnichat-title">
          Omnichat
        </h1>
        <p className="text-muted-foreground mt-2">
          Unified communication center
        </p>
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

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-20rem)]">
              {selectedConversation ? (
                messages && messages.length > 0 ? (
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
