import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { isAnthropicConfigured, isStorageConfigured } from "@/core/config/env";
import { requireRole } from "@/modules/auth/authz";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import { HousecallProCredentialsForm } from "@/modules/tenancy/components/HousecallProCredentialsForm";
import { listFranchiseLocations } from "@/modules/tenancy/location-queries";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const locationsRead = await listFranchiseLocations();

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
  ];

  return (
    <>
      <PageHeading
        title="Settings"
        description="Integration credentials. Keys are encrypted at rest and never returned to the browser."
      />

      <Alert tone="warning" title="Housecall Pro has no test environment">
        Every write from this application lands in the live account. Records
        created outside production are prefixed with [TEST] and flagged, so they
        can be told apart from real customers at a glance.
      </Alert>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="Integration status"
            description="Read from environment variables at request time."
          />
          <CardBody className="divide-border-subtle divide-y">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-slate-900">
                    {integration.name}
                  </p>
                  <p className="text-sm text-slate-500">{integration.detail}</p>
                </div>
                {integration.configured ? (
                  <Badge tone="done">Configured</Badge>
                ) : (
                  <Badge tone="waiting">Not configured</Badge>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

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
