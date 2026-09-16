"use client";

import { Ruler } from "lucide-react";
import { useState } from "react";

import type { DimensionConfirmationResponse } from "@/modules/intake/components/ChatWidget/useIntakeSession";
import {
  StreamCard,
  StreamCardNote,
} from "@/modules/intake/components/ChatWidget/StreamCard";
import type { DimensionConfirmationPrompt } from "@/modules/intake/types";

function roundedInches(inches: number): string {
  return String(Math.round(inches));
}

function approximateFeet(widthInches: number, heightInches: number): string {
  const toFeet = (inches: number) => Math.round((inches / 12) * 2) / 2;
  return `about ${toFeet(widthInches)} ft by ${toFeet(heightInches)} ft`;
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
    <StreamCard icon={Ruler} label="Check my measurement">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-display text-brand-950 text-[1.875rem] leading-8 font-bold tracking-[-0.02em]">
          {roundedInches(prompt.widthInches)} × {roundedInches(prompt.heightInches)} in
        </span>
        <span className="text-[13.5px] text-slate-600">
          {approximateFeet(prompt.widthInches, prompt.heightInches)}
        </span>
      </div>

      <p className="text-[14px] leading-[22px] text-slate-600">
        {prompt.summary} Does that sound about right?
      </p>

      {isCorrecting ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <label className="flex-1">
              <span className="text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase">
                Width (inches)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={400}
                value={width}
                onChange={(event) => setWidth(event.target.value)}
                className="border-border-strong focus:border-brand-500 focus:ring-brand-500/20 mt-1.5 h-11.5 w-full rounded-lg border px-3 text-sm focus:ring-3 focus:outline-none"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase">
                Height (inches)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={400}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                className="border-border-strong focus:border-brand-500 focus:ring-brand-500/20 mt-1.5 h-11.5 w-full rounded-lg border px-3 text-sm focus:ring-3 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2.5">
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
              className="bg-brand-700 hover:bg-brand-900 disabled:bg-brand-200 inline-flex h-11.5 flex-1 items-center justify-center rounded-lg px-4 text-[14.5px] font-semibold text-white"
            >
              Use my measurement
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCorrecting(false)}
              className="border-border-strong hover:bg-surface-sunken text-brand-800 inline-flex h-11.5 items-center justify-center rounded-lg border px-4 text-[14.5px] font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRespond({ response: "CONFIRMED" })}
            className="bg-brand-700 hover:bg-brand-900 disabled:bg-brand-200 inline-flex h-11.5 items-center justify-center rounded-lg px-4 text-[14.5px] font-semibold text-white"
          >
            That sounds right
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCorrecting(true)}
              className="border-border-strong hover:bg-surface-sunken text-brand-800 inline-flex h-11.5 flex-1 items-center justify-center rounded-lg border px-4 text-[14.5px] font-semibold"
            >
              Different size
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onRespond({ response: "UNSURE" })}
              className="border-border-strong hover:bg-surface-sunken text-brand-800 inline-flex h-11.5 flex-1 items-center justify-center rounded-lg border px-4 text-[14.5px] font-semibold"
            >
              Not sure
            </button>
          </div>
        </div>
      )}

      <StreamCardNote>
        An estimate from a photo. A glazier measures on site before any glass is
        cut.
      </StreamCardNote>
    </StreamCard>
  );
}
