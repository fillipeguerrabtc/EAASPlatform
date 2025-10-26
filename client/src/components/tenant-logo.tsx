import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";

export function TenantLogo({ className = "h-8" }: { className?: string }) {
  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const currentTenant = tenants?.[0];

  if (!currentTenant?.logoUrl) {
    return (
      <div className="flex items-center gap-2">
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2L2 7V17C2 19.21 3.79 21 6 21H18C20.21 21 22 19.21 22 17V7L12 2Z"
            fill="currentColor"
            className="text-primary"
          />
        </svg>
        <span className="font-semibold text-lg">EAAS</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <img
        src={currentTenant.logoUrl}
        alt={currentTenant.name || "Logo"}
        className={className}
        style={{ objectFit: "contain" }}
        data-testid="img-tenant-logo"
      />
      <span className="font-semibold text-lg hidden sm:inline" data-testid="text-tenant-name-logo">
        {currentTenant.name}
      </span>
    </div>
  );
}
