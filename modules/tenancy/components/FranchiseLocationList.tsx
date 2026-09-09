import { Building2, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FranchiseLocationRow } from "@/modules/tenancy/location-queries";

export function FranchiseLocationList({
  locations,
}: {
  locations: readonly FranchiseLocationRow[];
}) {
  if (locations.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={Building2}
            title="No locations configured"
            description="Territory routing cannot place a job without at least one active location. Add one below."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {locations.map((location) => (
        <Card key={location.id}>
          <CardHeader
            title={location.name}
            description={`${location.sessionCount.toLocaleString()} sessions routed here`}
            action={
              location.isActive ? (
                <Badge tone="done">Active</Badge>
              ) : (
                <Badge tone="neutral">Inactive</Badge>
              )
            }
          />
          <CardBody className="space-y-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Slug</dt>
                <dd className="font-mono text-xs text-slate-700">
                  {location.slug}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Price book</dt>
                <dd className="font-mono text-xs text-slate-700">
                  {location.priceBookId ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Housecall Pro account</dt>
                <dd className="font-mono text-xs text-slate-700">
                  {location.housecallProAccountId ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">API key</dt>
                <dd>
                  {location.hasApiKey ? (
                    <Badge tone="done">
                      <KeyRound className="size-3" aria-hidden="true" />
                      Stored
                    </Badge>
                  ) : (
                    <Badge tone="waiting">Not set</Badge>
                  )}
                </dd>
              </div>
            </dl>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Territory ({location.territory.zipCodes.length} ZIP codes)
              </p>
              {location.territory.zipCodes.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Empty territory. Nothing will route here.
                </p>
              ) : (
                <p className="font-mono text-xs leading-relaxed text-slate-600">
                  {location.territory.zipCodes.slice(0, 12).join(", ")}
                  {location.territory.zipCodes.length > 12
                    ? `, +${location.territory.zipCodes.length - 12} more`
                    : ""}
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
