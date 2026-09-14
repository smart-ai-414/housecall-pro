export interface TemplateLine {
  label: string;
  formula: string;
}

export const NON_CATALOGUE_TEMPLATE: readonly TemplateLine[] = [
  { label: "Service call", formula: "$105 flat" },
  { label: "Material", formula: "material value x 1.5" },
  { label: "Labour", formula: "hours x $75" },
  { label: "Miscellaneous", formula: "$50 to $100" },
];

export const NON_CATALOGUE_TEMPLATE_CAVEAT =
  "These are the shop's own figures, reproduced for the reviewer to apply by hand. The assistant does not apply them and no amount from them is stored.";

export function renderNonCatalogueTemplate(): string[] {
  return [
    "PRICING TEMPLATE (work with no price book item):",
    ...NON_CATALOGUE_TEMPLATE.map(
      (line) => `  ${line.label.padEnd(15)}${line.formula}`,
    ),
    `  ${NON_CATALOGUE_TEMPLATE_CAVEAT}`,
  ];
}
