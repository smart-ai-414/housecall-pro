import type { HousecallProClient } from "@/modules/housecall-pro/client";
import { HousecallProError } from "@/modules/housecall-pro/errors";
import type {
  HousecallProCreateEstimateRequest,
  HousecallProEstimate,
  HousecallProEstimateLineItem,
  HousecallProPagedResponse,
} from "@/modules/housecall-pro/types";

const ESTIMATES_PATH = "estimates";

export const DEFAULT_OPTION_NAME = "Option 1";

export interface DraftEstimateInput {
  customerId: string;
  addressId?: string | null;
  leadSource?: string | null;
  lineItems: HousecallProEstimateLineItem[];
  note: string;
  idempotencyKey: string;
}

export async function createUnsentEstimate(
  client: HousecallProClient,
  input: DraftEstimateInput,
): Promise<HousecallProEstimate> {
  const payload: HousecallProCreateEstimateRequest = {
    customer_id: input.customerId,
    options: [
      {
        name: DEFAULT_OPTION_NAME,
        message_from_pro: input.note,
        line_items: input.lineItems,
      },
    ],
    note: input.note,
    ...(input.addressId ? { address_id: input.addressId } : {}),
    ...(input.leadSource ? { lead_source: input.leadSource } : {}),
  };

  const estimate = await client.request<HousecallProEstimate>({
    method: "POST",
    path: ESTIMATES_PATH,
    body: payload,
    idempotencyKey: input.idempotencyKey,
    attemptLimit: 1,
  });

  if (!estimate?.id) {
    throw new HousecallProError({
      kind: "UNEXPECTED_RESPONSE",
      message: "Estimate creation returned no id",
    });
  }

  return estimate;
}

export async function getEstimate(
  client: HousecallProClient,
  estimateId: string,
): Promise<HousecallProEstimate> {
  return client.request<HousecallProEstimate>({
    method: "GET",
    path: `${ESTIMATES_PATH}/${estimateId}`,
  });
}

export interface LineItemWithOption extends HousecallProEstimateLineItem {
  optionId: string;
  optionName: string | null;
}

export async function getEstimateLineItems(
  client: HousecallProClient,
  estimateId: string,
): Promise<LineItemWithOption[]> {
  const estimate = await getEstimate(client, estimateId);
  const options = estimate.options ?? [];

  const perOption = await Promise.all(
    options.map(async (option) => {
      const response = await client.request<
        HousecallProPagedResponse<HousecallProEstimateLineItem>
      >({
        method: "GET",
        path: `${ESTIMATES_PATH}/${estimateId}/options/${option.id}/line_items`,
      });

      return (response?.line_items ?? []).map((lineItem) => ({
        ...lineItem,
        optionId: option.id,
        optionName: option.name ?? null,
      }));
    }),
  );

  return perOption.flat();
}

export interface PhotoReference {
  label: string;
  storageKey: string;
  signedUrl: string;
}

export const PLACEHOLDER_LINE_ITEM_NAME = "Glass service — awaiting pricing";

export const PLACEHOLDER_LINE_ITEM_DESCRIPTION =
  "Placeholder only. Replace with the matching price book item. The customer's photos and answers are in the notes below.";

export function buildPlaceholderLineItem(): HousecallProEstimateLineItem {
  return {
    name: PLACEHOLDER_LINE_ITEM_NAME,
    description: PLACEHOLDER_LINE_ITEM_DESCRIPTION,
    quantity: 1,
    kind: "labor",
    order_index: 0,
  };
}

export function buildLineItemsFromCatalogueMatches(
  matches: readonly {
    housecallProServiceId: string;
    serviceName: string;
    quantity: number;
    isBaseItem: boolean;
    isAdditionalOpening: boolean;
    openingIndex: number | null;
  }[],
): HousecallProEstimateLineItem[] {
  if (matches.length === 0) return [buildPlaceholderLineItem()];

  return matches.map((match, index) => ({
    service_item_id: match.housecallProServiceId,
    name: match.serviceName,
    quantity: match.quantity,
    kind: "labor",
    order_index: index,
    ...(match.isAdditionalOpening
      ? { description: `Opening ${match.openingIndex ?? "?"}` }
      : {}),
  }));
}
