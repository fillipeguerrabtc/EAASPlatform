import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Heart, User, Package, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type WishlistItem = {
  id: string;
  customerId: string;
  productId: string;
  addedAt: string;
  customerName: string | null;
  customerEmail: string | null;
  productName: string | null;
  productPrice: string | null;
  productImage: string | null;
};

export default function Wishlists() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: items, isLoading } = useQuery<WishlistItem[]>({
    queryKey: ["/api/admin/wishlists"],
  });

  const filteredItems = items?.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
      item.customerName?.toLowerCase().includes(search) ||
      item.customerEmail?.toLowerCase().includes(search) ||
      item.productName?.toLowerCase().includes(search)
    );
  }) || [];

  // Calculate KPIs
  const totalItems = items?.length || 0;
  const uniqueCustomers = new Set(items?.map((i) => i.customerId)).size;
  const uniqueProducts = new Set(items?.map((i) => i.productId)).size;

  // Find most wished products
  const productCounts: Record<string, { name: string; count: number }> = {};
  items?.forEach((item) => {
    if (item.productId && item.productName) {
      if (!productCounts[item.productId]) {
        productCounts[item.productId] = { name: item.productName, count: 0 };
      }
      productCounts[item.productId].count++;
    }
  });

  const topProducts = Object.entries(productCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-wishlists">
            Listas de Desejos
          </h1>
          <p className="text-muted-foreground">
            Produtos favoritos dos customers
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Items</CardTitle>
            <Heart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-total-items">
              {totalItems}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <User className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-unique-customers">
              {uniqueCustomers}
            </div>
            <p className="text-xs text-muted-foreground">Com wishlists</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Únicos</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-unique-products">
              {uniqueProducts}
            </div>
            <p className="text-xs text-muted-foreground">Na wishlist</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mais Desejado</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <>
                <div className="text-2xl font-bold" data-testid="kpi-top-product-count">
                  {topProducts[0][1].count}
                </div>
                <p className="text-xs text-muted-foreground truncate" data-testid="kpi-top-product-name">
                  {topProducts[0][1].name}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum produto</div>
            )}
          </CardContent>
        </Card>
      </div>

      {topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Produtos Mais Desejados</CardTitle>
            <CardDescription>Produtos com mais adições em wishlists</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProducts.map(([productId, data], index) => (
                <div
                  key={productId}
                  className="flex items-center justify-between gap-4 p-2 rounded hover-elevate"
                  data-testid={`top-product-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-8 text-center">
                      #{index + 1}
                    </Badge>
                    <span className="font-medium">{data.name}</span>
                  </div>
                  <Badge data-testid={`top-product-count-${index}`}>
                    {data.count} {data.count === 1 ? "customer" : "customers"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Todos os Items da Wishlist</CardTitle>
              <CardDescription>
                {filteredItems.length} de {items?.length || 0} items
              </CardDescription>
            </div>
            <Input
              placeholder="Buscar customer ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum item encontrado" : "Nenhuma wishlist cadastrada"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Adicionado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-wishlist-${item.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-customer-${item.id}`}>
                      {item.customerName || "-"}
                    </TableCell>
                    <TableCell data-testid={`cell-email-${item.id}`}>
                      {item.customerEmail || "-"}
                    </TableCell>
                    <TableCell data-testid={`cell-product-${item.id}`}>
                      <div className="flex items-center gap-2">
                        {item.productImage && (
                          <img
                            src={item.productImage}
                            alt={item.productName || "Product"}
                            className="w-8 h-8 object-cover rounded"
                          />
                        )}
                        <span>{item.productName || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-price-${item.id}`}>
                      {item.productPrice ? `$${parseFloat(item.productPrice).toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell data-testid={`cell-added-${item.id}`}>
                      {format(parseISO(item.addedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
