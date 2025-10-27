import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RefreshCw, PlayCircle, XCircle, AlertCircle, CheckCircle, Clock, Play, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
type JobType = "crm_csv_import" | "marketing_campaign" | "brand_extract" | "brand_clone" | "email_send" | "other";

interface Job {
  id: string;
  tenantId: string;
  type: JobType;
  status: JobStatus;
  payload: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  scheduledFor: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface QueueStats {
  byStatus: Record<JobStatus, number>;
  byType: Record<JobType, number>;
  recentFailures: number;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  processing: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  failed: "bg-red-500/20 text-red-700 dark:text-red-400",
  cancelled: "bg-gray-500/20 text-gray-700 dark:text-gray-400",
};

const STATUS_ICONS: Record<JobStatus, any> = {
  pending: Clock,
  processing: PlayCircle,
  completed: CheckCircle,
  failed: AlertCircle,
  cancelled: XCircle,
};

export default function QueueDashboard() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const [page, setPage] = useState(1);
  const [searchId, setSearchId] = useState("");

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<QueueStats>({
    queryKey: ["/api/admin/queue/stats"],
    refetchInterval: 5000, // Auto-refresh every 5s
  });

  // Build query string for jobs
  const buildJobsQuery = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    params.set("page", page.toString());
    params.set("limit", "50");
    return `/api/admin/queue/jobs?${params.toString()}`;
  };

  // Fetch jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ jobs: Job[], pagination: any }>({
    queryKey: ["/api/admin/queue/jobs", statusFilter, typeFilter, page],
    queryFn: async () => {
      const res = await fetch(buildJobsQuery(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5s
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/admin/queue/jobs/${jobId}/retry`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/stats"] });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/admin/queue/jobs/${jobId}/cancel`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/stats"] });
    },
  });

  const jobs = jobsData?.jobs ?? [];
  const pagination = jobsData?.pagination;

  const filteredJobs = searchId
    ? jobs.filter((job: Job) => job.id.toLowerCase().includes(searchId.toLowerCase()))
    : jobs;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-queue-title">Job Queue Dashboard</h1>
          <p className="text-muted-foreground">PostgreSQL-based async job processing</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/queue/stats"] });
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card data-testid="card-stat-pending">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pending-count">
                  {stats?.byStatus?.pending || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-processing">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Processing</CardTitle>
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-processing-count">
                  {stats?.byStatus?.processing || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-completed">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-completed-count">
                  {stats?.byStatus?.completed || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-failed">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed (24h)</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-failed-count">
                  {stats?.recentFailures || 0}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Type</label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger data-testid="select-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="crm_csv_import">CRM CSV Import</SelectItem>
                <SelectItem value="marketing_campaign">Marketing Campaign</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Search Job ID</label>
            <Input
              placeholder="Search by ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              data-testid="input-search-id"
            />
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No jobs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job: Job) => {
                const StatusIcon = STATUS_ICONS[job.status];
                return (
                  <div
                    key={job.id}
                    className="border rounded-md p-4 space-y-3"
                    data-testid={`job-${job.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={STATUS_COLORS[job.status]} data-testid={`badge-status-${job.id}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {job.status}
                          </Badge>
                          <Badge variant="outline" data-testid={`badge-type-${job.id}`}>
                            {job.type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground" data-testid={`text-id-${job.id}`}>
                            ID: {job.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span data-testid={`text-created-${job.id}`}>
                            Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                          {job.processedAt && (
                            <span data-testid={`text-processed-${job.id}`}>
                              Processed {formatDistanceToNow(new Date(job.processedAt), { addSuffix: true })}
                            </span>
                          )}
                          <span data-testid={`text-attempts-${job.id}`}>
                            Attempts: {job.attempts}/{job.maxAttempts}
                          </span>
                          <span data-testid={`text-priority-${job.id}`}>Priority: {job.priority}</span>
                        </div>
                        {job.error && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-600 dark:text-red-400" data-testid={`text-error-${job.id}`}>
                            {job.error}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {job.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryMutation.mutate(job.id)}
                            disabled={retryMutation.isPending}
                            data-testid={`button-retry-${job.id}`}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        {job.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelMutation.mutate(job.id)}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-${job.id}`}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
