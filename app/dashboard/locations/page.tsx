import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { requireRole } from "@/modules/auth/authz";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import { FranchiseLocationForm } from "@/modules/tenancy/components/FranchiseLocationForm";
import { FranchiseLocationList } from "@/modules/tenancy/components/FranchiseLocationList";
import {
  findOverlappingZipCodes,
  listFranchiseLocations,
} from "@/modules/tenancy/location-queries";

export const metadata: Metadata = {
  title: "Locations",
};

export default async function LocationsPage() {
  await requireRole("ADMIN");
  const locationsRead = await listFranchiseLocations();

  if (!locationsRead.ok) {
    return (
      <>
        <PageHeading
          title="Locations"
          description="Franchise territories and their Housecall Pro price books."
        />
        <Alert tone="warning" title="Locations unavailable">
          {locationsRead.message}
        </Alert>
      </>
    );
  }

  const overlaps = findOverlappingZipCodes(locationsRead.data);

  return (
    <>
      <PageHeading
        title="Locations"
        description="Franchise territories and their Housecall Pro price books. A service address is routed to a location before any estimate is created."
      />

      {overlaps.length > 0 ? (
        <Alert tone="warning" title="Overlapping territories" className="mb-6">
          {overlaps.join(", ")} appear in more than one active territory. Jobs
          in those ZIP codes will be held for manual routing rather than sent to
          an arbitrary location.
        </Alert>
      ) : null}

      <div className="space-y-6">
        <FranchiseLocationList locations={locationsRead.data} />
        <FranchiseLocationForm locations={locationsRead.data} />
      </div>
    </>
  );
}
