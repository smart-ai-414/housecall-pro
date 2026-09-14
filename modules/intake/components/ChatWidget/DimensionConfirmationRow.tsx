"use client";

import { Ruler } from "lucide-react";
import { useState } from "react";

import type { DimensionConfirmationResponse } from "@/modules/intake/components/ChatWidget/useIntakeSession";
import type { DimensionConfirmationPrompt } from "@/modules/intake/types";

function roundedInches(inches: number): string {
  return String(Math.round(inches));
}

export function DimensionConfirmationRow({
  prompt,
  isSubmitting,
  onRespond,
}: {
  prompt: DimensionConfirmationPrompt;
  isSubmitting: boolean;
  onRespond: (input: {
    response: DimensionConfirmationResponse;
    widthInches?: number | null;
    heightInches?: number | null;
  }) => void;
}) {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [width, setWidth] = useState(roundedInches(prompt.widthInches));
  const [height, setHeight] = useState(roundedInches(prompt.heightInches));

  const correctedWidth = Number.parseFloat(width);
  const correctedHeight = Number.parseFloat(height);
  const correctionIsUsable =
    Number.isFinite(correctedWidth) &&
    correctedWidth > 0 &&
    Number.isFinite(correctedHeight) &&
    correctedHeight > 0;

  return (
    <div className="ring-border-subtle space-y-2.5 rounded-lg bg-white px-3 py-3 ring-1">
      <p className="flex items-start gap-2 text-sm text-slate-800">
        <Ruler className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{prompt.summary} Does that sound about right?</span>
      </p>

      {isCorrecting ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-xs font-medium text-slate-600">
                Width (inches)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={400}
                value={width}
                onChange={(event) => setWidth(event.target.value)}
                className="ring-border-strong focus:ring-brand-600 mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm ring-1 focus:ring-2"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs font-medium text-slate-600">
                Height (inches)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={400}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                className="ring-border-strong focus:ring-brand-600 mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm ring-1 focus:ring-2"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting || !correctionIsUsable}
              onClick={() =>
                onRespond({
                  response: "CORRECTED",
                  widthInches: correctedWidth,
                  heightInches: correctedHeight,
                })
              }
              className="bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            >
              Use my measurement
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCorrecting(false)}
              className="ring-border-strong rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRespond({ response: "CONFIRMED" })}
            className="bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            That sounds right
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setIsCorrecting(true)}
            className="ring-border-strong rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1"
          >
            It is a different size
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRespond({ response: "UNSURE" })}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 underline"
          >
            I am not sure
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        We read this from your photos, so it is an estimate. A glazier measures
        it before any glass is ordered.
      </p>
    </div>
  );
}
