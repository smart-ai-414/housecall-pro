export interface PriceBand {
  label: string;
  maxSquareFeet: number | null;
}

export const PRICE_BANDS: readonly PriceBand[] = [
  { label: "UP_TO_7_SQFT", maxSquareFeet: 7 },
  { label: "8_TO_10_SQFT", maxSquareFeet: 10 },
  { label: "11_TO_14_SQFT", maxSquareFeet: 14 },
  { label: "15_TO_20_SQFT", maxSquareFeet: 20 },
  { label: "21_TO_30_SQFT", maxSquareFeet: 30 },
  { label: "OVER_30_SQFT", maxSquareFeet: null },
];

export function priceBandFor(squareFeet: number): string {
  const band = PRICE_BANDS.find(
    (candidate) =>
      candidate.maxSquareFeet === null || squareFeet <= candidate.maxSquareFeet,
  );

  return band?.label ?? "OVER_30_SQFT";
}

export function describePriceBand(label: string): string {
  switch (label) {
    case "UP_TO_7_SQFT":
      return "up to 7 sq ft";
    case "8_TO_10_SQFT":
      return "8 to 10 sq ft";
    case "11_TO_14_SQFT":
      return "11 to 14 sq ft";
    case "15_TO_20_SQFT":
      return "15 to 20 sq ft";
    case "21_TO_30_SQFT":
      return "21 to 30 sq ft";
    case "OVER_30_SQFT":
      return "over 30 sq ft";
    default:
      return label;
  }
}
