import { useQuery, QueryKey } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export interface PaginationMetadata {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UsePaginatedQueryOptions {
  initialPage?: number;
  initialPageSize?: number;
  initialSearch?: string;
}

export interface UsePaginatedQueryResult<T> {
  data: T[] | undefined;
  pagination: PaginationMetadata | undefined;
  isLoading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  search: string;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearch: (search: string) => void;
  nextPage: () => void;
  prevPage: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

async function fetchWithPagination<T>(
  url: string,
  page: number,
  pageSize: number,
  search: string
): Promise<{ data: T[]; pagination: PaginationMetadata }> {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("pageSize", pageSize.toString());
  if (search) {
    params.set("q", search);
  }

  const response = await fetch(`${url}?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  const pagination: PaginationMetadata = {
    totalCount: parseInt(response.headers.get("X-Total-Count") || "0", 10),
    page: parseInt(response.headers.get("X-Page") || "1", 10),
    pageSize: parseInt(response.headers.get("X-Page-Size") || "20", 10),
    totalPages: parseInt(response.headers.get("X-Total-Pages") || "1", 10),
  };

  return { data, pagination };
}

export function usePaginatedQuery<T>(
  queryKey: QueryKey,
  url: string,
  options: UsePaginatedQueryOptions = {}
): UsePaginatedQueryResult<T> {
  const [page, setPage] = useState(options.initialPage || 1);
  const [pageSize, setPageSize] = useState(options.initialPageSize || 20);
  const [search, setSearch] = useState(options.initialSearch || "");

  const { data, isLoading, error } = useQuery({
    queryKey: [...(Array.isArray(queryKey) ? queryKey : [queryKey]), page, pageSize, search],
    queryFn: () => fetchWithPagination<T>(url, page, pageSize, search),
    placeholderData: (previousData) => previousData, // Keep previous data during transitions
  });

  // Auto-clamp page when results change (including empty results)
  useEffect(() => {
    if (data?.pagination) {
      const serverPage = data.pagination.page;
      const totalPages = data.pagination.totalPages;
      
      // If no results (totalPages = 0), reset to page 1
      // If current page exceeds total pages, clamp to total pages
      if (totalPages === 0 && page !== 1) {
        setPage(1);
      } else if (totalPages > 0 && page > totalPages) {
        setPage(totalPages);
      }
    }
  }, [data?.pagination, page]);

  const hasNextPage = data?.pagination ? page < data.pagination.totalPages : false;
  const hasPrevPage = page > 1;

  return {
    data: data?.data,
    pagination: data?.pagination,
    isLoading,
    error: error as Error | null,
    page,
    pageSize,
    search,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1); // Reset to first page when changing page size
    },
    setSearch: (newSearch: string) => {
      setSearch(newSearch);
      setPage(1); // Reset to first page when searching
    },
    nextPage: () => {
      if (hasNextPage) setPage(page + 1);
    },
    prevPage: () => {
      if (hasPrevPage) setPage(page - 1);
    },
    hasNextPage,
    hasPrevPage,
  };
}
