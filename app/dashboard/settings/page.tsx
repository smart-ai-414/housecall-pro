import { Check } from "lucide-react";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { isAnthropicConfigured, isStorageConfigured } from "@/core/config/env";
import { formatDateTime } from "@/core/utils/format";
import { requireRole } from "@/modules/auth/authz";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import {
  catalogueSnapshotAgeInDays,
  catalogueSnapshotExportedAt,
  catalogueSnapshotIsStale,
  loadCatalogueSnapshot,
} from "@/modules/pricing/catalogue-snapshot";
import { HousecallProCredentialsForm } from "@/modules/tenancy/components/HousecallProCredentialsForm";
import { listFranchiseLocations } from "@/modules/tenancy/location-queries";

export const metadata: Metadata = {
  title: "Settings",
};

const BOT_PROTECTION_CONFIGURED =
  (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "") !== "";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const locationsRead = await listFranchiseLocations();
  const catalogue = loadCatalogueSnapshot();

  const integrations = [
    {
      name: "Photo storage",
      configured: isStorageConfigured(),
      detail:
        "Signed direct-to-storage uploads. Photos never pass through this server.",
    },
    {
      name: "Claude (Anthropic)",
      configured: isAnthropicConfigured(),
      detail:
        "Classification and dimension estimation. Every call costs money, which is why intake is rate limited.",
    },
    {
      name: "Bot protection",
      configured: BOT_PROTECTION_CONFIGURED,
      detail:
        "Turnstile on session creation, plus per-IP rate limiting on the intake endpoints.",
    },
  ];

  return (
    <>
      <PageHeading
        title="Settings"
        description="Integration credentials. Keys are encrypted at rest and never returned to the browser."
      />

      <Alert tone="warning" title="Housecall Pro has no test environment">
        Every write from this application lands in the live account. Records
        created outside production are prefixed [TEST] and flagged, so they can
        be told apart from real customers at a glance.
      </Alert>

      <div className="mt-5 grid gap-5 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Integration status"
              description="Read from environment variables at request time."
            />
            <CardBody className="py-0">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 py-3.5 last:border-b-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {integration.name}
                    </p>
                    <p className="text-[13px] leading-5 text-slate-500">
                      {integration.detail}
                    </p>
                  </div>
                  {integration.configured ? (
                    <Badge tone="done">
                      <Check className="size-3" aria-hidden="true" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge tone="waiting">Not configured</Badge>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Catalogue"
              description="The closed set the assistant matches against. Never a generated price."
            />
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {catalogue.squareFootageBanded.length} items banded by square
                    footage
                  </p>
                  <p className="text-[13px] text-slate-500">
                    {catalogue.allServiceItems.length} service items in total ·
                    exported {formatDateTime(catalogueSnapshotExportedAt())}
                  </p>
                </div>
                {catalogueSnapshotIsStale() ? (
                  <Badge tone="waiting">
                    Stale · {catalogueSnapshotAgeInDays()} days old
                  </Badge>
                ) : (
                  <Badge tone="done">Current</Badge>
                )}
              </div>

              <Alert tone="info">
                There is no price, amount or total column anywhere in this
                application. Catalogue matches store an item identifier only.
              </Alert>
            </CardBody>
          </Card>
        </div>

        {locationsRead.ok ? (
          <HousecallProCredentialsForm locations={locationsRead.data} />
        ) : (
          <Alert tone="warning" title="Locations unavailable">
            {locationsRead.message}
          </Alert>
        )}
      </div>
    </>
  );
}
