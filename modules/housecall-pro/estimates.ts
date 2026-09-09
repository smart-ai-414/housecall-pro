import type { HousecallProClient } from "@/modules/housecall-pro/client";
import { HousecallProError } from "@/modules/housecall-pro/errors";
import type {
  HousecallProAttachmentResponse,
  HousecallProCreateEstimateRequest,
  HousecallProEstimate,
  HousecallProEstimateLineItem,
} from "@/modules/housecall-pro/types";

const ESTIMATES_PATH = "estimates";

export interface DraftEstimateInput {
  customerId: string;
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
    line_items: input.lineItems,
    note: input.note,
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

export type PhotoAttachmentOutcome =
  | { method: "UPLOADED"; attachmentId: string }
  | { method: "LINKED_IN_NOTES"; urls: string[] };

export interface PhotoToAttach {
  label: string;
  storageKey: string;
  signedUrl: string;
}

export async function attachPhotosToEstimate({
  client,
  estimateId,
  photos,
  uploadAttachment,
}: {
  client: HousecallProClient;
  estimateId: string;
  photos: readonly PhotoToAttach[];
  uploadAttachment?: (photo: PhotoToAttach) => Promise<Buffer>;
}): Promise<PhotoAttachmentOutcome> {
  if (photos.length === 0) {
    return { method: "LINKED_IN_NOTES", urls: [] };
  }

  if (uploadAttachment) {
    try {
      const first = photos[0];
      const body = await uploadAttachment(first);

      const response = await client.request<HousecallProAttachmentResponse>({
        method: "POST",
        path: `${ESTIMATES_PATH}/${estimateId}/attachments`,
        body: {
          file_name: `${first.label}.jpg`,
          content_type: "image/jpeg",
          data: body.toString("base64"),
        },
        attemptLimit: 2,
      });

      if (response?.id) {
        return { method: "UPLOADED", attachmentId: response.id };
      }
    } catch (error) {
      console.warn(
        "[housecall-pro] attachment upload failed, falling back to signed links",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    method: "LINKED_IN_NOTES",
    urls: photos.map((photo) => photo.signedUrl),
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
  return matches.map((match) => ({
    service_item_id: match.housecallProServiceId,
    name: match.serviceName,
    quantity: match.quantity,
    kind: "service",
    description: match.isAdditionalOpening
      ? `Opening ${match.openingIndex ?? "?"}`
      : undefined,
  }));
}
