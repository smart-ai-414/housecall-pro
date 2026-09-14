import { CheckCircle2 } from "lucide-react";

import { BRAND } from "@/core/config/branding";

export function CompletionNotice({
  locationName,
}: {
  locationName: string | null;
}) {
  return (
    <div className="space-y-1.5 rounded-lg bg-green-50 px-3 py-3 ring-1 ring-green-200 ring-inset">
      <p className="flex items-center gap-2 text-sm font-semibold text-green-900">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Sent to our team
      </p>
      <p className="text-sm text-green-900">
        {locationName
          ? `${locationName} has everything they need.`
          : "Our team has everything they need."}{" "}
        A glazier prices the work and sends your estimate — usually the same
        day. Nothing is quoted automatically.
      </p>
      <p className="text-xs text-green-800">
        Remembered something? Add it below, or call {BRAND.phone}.
      </p>
    </div>
  );
}
