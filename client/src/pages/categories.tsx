import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Edit2, Trash2, FolderTree, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCategorySchema, type Category, type InsertCategory } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SEO } from "@/components/seo";

export default function CategoriesPage() {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema.omit({ tenantId: true })),
    defaultValues: {
      name: "",
      description: "",
      parentId: null,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertCategory) => {
      return apiRequest("/api/categories", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria criada com sucesso!" });
      form.reset();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCategory> }) => {
      return apiRequest(`/api/categories/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria atualizada com sucesso!" });
      setEditingCategory(null);
      form.reset();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/categories/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria deletada com sucesso!" });
      setDeletingCategory(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao deletar categoria", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: InsertCategory) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowForm(true);
    form.reset({
      name: category.name,
      description: category.description || "",
      parentId: category.parentId,
    });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setShowForm(false);
    form.reset();
  };

  // Get all descendants (children, grandchildren, etc) of a category
  const getAllDescendants = (categoryId: string, allCategories: Category[]): string[] => {
    const children = allCategories.filter(cat => cat.parentId === categoryId);
    const descendants = children.map(child => child.id);
    children.forEach(child => {
      descendants.push(...getAllDescendants(child.id, allCategories));
    });
    return descendants;
  };

  // Recursive component for category tree
  const CategoryTreeItem = ({ category, level = 0 }: { category: Category; level?: number }) => {
    const children = categories.filter(cat => cat.parentId === category.id);
    const hasDescendants = children.length > 0;

    return (
      <div className={level > 0 ? "ml-6 mt-2" : "mt-4 first:mt-0"}>
        <Card className="border-primary/20 hover-elevate" data-testid={`card-category-${category.id}`}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  {level > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <FolderTree className="w-4 h-4 text-primary" />
                  <span data-testid={`text-category-name-${category.id}`}>{category.name}</span>
                  {hasDescendants && (
                    <span className="text-xs text-muted-foreground">({children.length} subcategoria{children.length > 1 ? 's' : ''})</span>
                  )}
                </CardTitle>
                {category.description && (
                  <CardDescription className="mt-2 text-sm" data-testid={`text-category-description-${category.id}`}>
                    {category.description}
                  </CardDescription>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(category)}
                  data-testid={`button-edit-category-${category.id}`}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeletingCategory(category)}
                  data-testid={`button-delete-category-${category.id}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Deletar
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
        {/* Render children recursively */}
        {children.map(child => (
          <CategoryTreeItem key={child.id} category={child} level={level + 1} />
        ))}
      </div>
    );
  };

  const rootCategories = categories.filter(cat => !cat.parentId);

  // Get valid parent options (exclude self and descendants to prevent cycles)
  const getValidParentOptions = () => {
    if (!editingCategory) return categories;
    const descendants = getAllDescendants(editingCategory.id, categories);
    return categories.filter(cat => cat.id !== editingCategory.id && !descendants.includes(cat.id));
  };

  const descendantCount = deletingCategory ? getAllDescendants(deletingCategory.id, categories).length : 0;

  return (
    <>
      <SEO
        title="Categorias - EAAS Platform"
        description="Gerencie categorias hierárquicas para organizar produtos e serviços no marketplace EAAS. Sistema completo de gestão empresarial com IA autônoma."
        keywords="categorias, produtos, serviços, marketplace, gestão, EAAS"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent" data-testid="title-categories">
                Categorias
              </h1>
              <p className="text-muted-foreground mt-1">
                Organize produtos e serviços em categorias hierárquicas
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingCategory(null);
                setShowForm(!showForm);
                form.reset();
              }}
              className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              data-testid="button-create-category"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card className="border-primary/20" data-testid="card-category-form">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-primary" />
                  {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                </CardTitle>
                <CardDescription>
                  {editingCategory ? "Atualize os dados da categoria" : "Preencha os dados da nova categoria"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Eletrônicos" data-testid="input-category-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder="Descrição da categoria"
                              data-testid="input-category-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria Pai (Opcional)</FormLabel>
                          <Select
                            value={field.value || ""}
                            onValueChange={(value) => field.onChange(value || null)}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-parent-category">
                                <SelectValue placeholder="Nenhuma (categoria raiz)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Nenhuma (categoria raiz)</SelectItem>
                              {getValidParentOptions().map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-submit-category"
                      >
                        {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : editingCategory ? "Atualizar" : "Criar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                        data-testid="button-cancel-category"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Categories Tree */}
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Carregando categorias...
              </CardContent>
            </Card>
          ) : categories.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma categoria cadastrada. Crie sua primeira categoria!
              </CardContent>
            </Card>
          ) : (
            <div>
              {rootCategories.map(category => (
                <CategoryTreeItem key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
          <AlertDialogContent data-testid="dialog-delete-category">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deletar a categoria <strong>{deletingCategory?.name}</strong>?
                {descendantCount > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    Atenção: Esta categoria possui {descendantCount} subcategoria{descendantCount > 1 ? 's' : ''} que também serão afetadas.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
