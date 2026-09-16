import { Building2, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/core/utils/cn";
import type { FranchiseLocationRow } from "@/modules/tenancy/location-queries";

const MAX_VISIBLE_ZIPS = 10;

function ZipChip({
  zipCode,
  isOverlapping,
}: {
  zipCode: string;
  isOverlapping: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6.5 items-center rounded border px-2.5 font-mono text-xs font-medium",
        isOverlapping
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-brand-100 bg-brand-50 text-brand-600",
      )}
    >
      {zipCode}
    </span>
  );
}

export function FranchiseLocationList({
  locations,
  overlappingZipCodes = [],
}: {
  locations: readonly FranchiseLocationRow[];
  overlappingZipCodes?: readonly string[];
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

  const overlapping = new Set(overlappingZipCodes);

  return (
    <div className="flex flex-col gap-3.5">
      {locations.map((location) => (
        <Card key={location.id}>
          <CardBody className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                    location.isActive
                      ? "border-brand-100 bg-brand-50"
                      : "border-border-subtle bg-surface-sunken",
                  )}
                >
                  <Building2
                    className={cn(
                      "size-5",
                      location.isActive ? "text-brand-600" : "text-slate-500",
                    )}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="font-display text-brand-950 text-base font-semibold">
                    {location.name}
                  </p>
                  <p className="text-[13px] text-slate-500">
                    {location.sessionCount.toLocaleString()} sessions routed
                    here · <span className="font-mono">{location.slug}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {location.isActive ? (
                  <Badge tone="done">Active</Badge>
                ) : (
                  <Badge tone="neutral">Not routing yet</Badge>
                )}
                {location.hasApiKey ? (
                  <Badge tone="done">
                    <KeyRound className="size-3" aria-hidden="true" />
                    API key set
                  </Badge>
                ) : (
                  <Badge tone="waiting">No API key</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3.5">
              <p className="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
                Territory · {location.territory.zipCodes.length} ZIP codes
              </p>
              {location.territory.zipCodes.length === 0 ? (
                <p className="text-[13px] text-amber-800">
                  Empty territory. Nothing will route here.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {location.territory.zipCodes
                    .slice(0, MAX_VISIBLE_ZIPS)
                    .map((zipCode) => (
                      <ZipChip
                        key={zipCode}
                        zipCode={zipCode}
                        isOverlapping={overlapping.has(zipCode)}
                      />
                    ))}
                  {location.territory.zipCodes.length > MAX_VISIBLE_ZIPS ? (
                    <span className="text-[12.5px] text-slate-400">
                      + {location.territory.zipCodes.length - MAX_VISIBLE_ZIPS}{" "}
                      more
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
                  Price book
                </span>
                <span className="font-mono text-xs text-slate-700">
                  {location.priceBookId ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
                  Housecall Pro account
                </span>
                <span className="font-mono text-xs text-slate-700">
                  {location.housecallProAccountId ?? "—"}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
