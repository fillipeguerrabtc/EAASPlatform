import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { PaginationMetadata } from "@/hooks/use-paginated-query";

interface PaginationControlsProps {
  pagination: PaginationMetadata | undefined;
  page: number;
  pageSize: number;
  search: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSearchChange: (search: string) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function PaginationControls({
  pagination,
  page,
  pageSize,
  search,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  hasNextPage,
  hasPrevPage,
  searchPlaceholder = "Buscar...",
  showSearch = true,
}: PaginationControlsProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {showSearch && (
        <div className="flex-1 max-w-sm">
          <Input
            data-testid="input-search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {pagination && (
          <span className="text-sm text-muted-foreground whitespace-nowrap" data-testid="text-pagination-info">
            {pagination.totalCount === 0
              ? "Nenhum resultado"
              : `${((page - 1) * pageSize + 1).toLocaleString()}-${Math.min(
                  page * pageSize,
                  pagination.totalCount
                ).toLocaleString()} de ${pagination.totalCount.toLocaleString()}`}
          </span>
        )}

        <div className="flex items-center gap-1">
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              onPageSizeChange(parseInt(value, 10));
              onPageChange(1);
            }}
          >
            <SelectTrigger data-testid="select-page-size" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">por página</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            data-testid="button-first-page"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(1)}
            disabled={!hasPrevPage}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            data-testid="button-prev-page"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrevPage}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground px-2 whitespace-nowrap" data-testid="text-current-page">
            Página {page} de {pagination?.totalPages || 1}
          </span>

          <Button
            data-testid="button-next-page"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            data-testid="button-last-page"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(pagination?.totalPages || 1)}
            disabled={!hasNextPage}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
