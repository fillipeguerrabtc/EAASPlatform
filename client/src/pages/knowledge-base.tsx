import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Book, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertKnowledgeBaseSchema, type KnowledgeBase } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "react-i18next";

const kbFormSchema = insertKnowledgeBaseSchema.omit({ tenantId: true, vectorId: true });

type KBFormData = typeof kbFormSchema._type;

export default function KnowledgeBasePage() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: items, isLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const form = useForm<KBFormData>({
    resolver: zodResolver(kbFormSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      tags: [],
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: KBFormData) => {
      return apiRequest("/api/knowledge-base", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setOpen(false);
      form.reset();
      toast({
        title: t('common.success'),
        description: t('knowledgeBase.createSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('knowledgeBase.createError'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/knowledge-base/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      toast({
        title: t('common.success'),
        description: t('knowledgeBase.deleteSuccess'),
      });
    },
  });

  const onSubmit = (data: KBFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold" data-testid="text-kb-title">
            {t('knowledgeBase.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('knowledgeBase.subtitle')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-kb-item">
              <Plus className="mr-2 h-4 w-4" /> {t('knowledgeBase.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('knowledgeBase.add')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('knowledgeBase.articleTitle')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('knowledgeBase.articleTitle')} data-testid="input-kb-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('knowledgeBase.content')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('knowledgeBase.content')} rows={8} data-testid="input-kb-content" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('knowledgeBase.category')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('knowledgeBase.category')} data-testid="input-kb-category" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-kb">
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-kb">
                    {createMutation.isPending ? t('common.loading') : t('common.save')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid gap-6">
          {items.map((item) => (
            <Card key={item.id} className="hover-elevate" data-testid={`card-kb-${item.id}`}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  {item.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(item.id)}
                  data-testid={`button-delete-kb-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {item.content}
                </p>
                {item.category && (
                  <span className="inline-block mt-4 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-md">
                    {item.category}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Book className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('knowledgeBase.noArticles')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('knowledgeBase.subtitle')}
          </p>
          <Button onClick={() => setOpen(true)} data-testid="button-create-first-kb">
            <Plus className="mr-2 h-4 w-4" /> {t('knowledgeBase.add')}
          </Button>
        </Card>
      )}
    </div>
  );
}
