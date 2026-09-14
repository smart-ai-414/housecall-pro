import type { PhotoType } from "@/generated/prisma/enums";

export const PHOTO_TYPE_GUIDANCE: Record<
  PhotoType,
  { label: string; instruction: string }
> = {
  INTERIOR_FLOOR_TO_CEILING: {
    label: "Inside, floor to ceiling",
    instruction:
      "Stand back inside the room and get the whole opening in frame, from the floor to the ceiling. The floor and ceiling give us the scale.",
  },
  EXTERIOR_FULL_ELEVATION: {
    label: "Outside, the whole wall",
    instruction:
      "From outside, capture the full wall the opening sits in, including the ground.",
  },
  CORNER_CLOSEUP: {
    label: "Close-up of a corner",
    instruction:
      "Get close to one corner of the glass so we can see the frame edge and any markings on the pane.",
  },
};

export const REQUIRED_PHOTO_TYPES: readonly PhotoType[] = [
  "INTERIOR_FLOOR_TO_CEILING",
  "EXTERIOR_FULL_ELEVATION",
];

export const CONDITIONAL_PHOTO_TYPE: PhotoType = "CORNER_CLOSEUP";

export const CORNER_CLOSEUP_REQUEST_MESSAGE = [
  "One more thing would help. I cannot tell the frame type from what I have,",
  "and that changes what we order.",
  PHOTO_TYPE_GUIDANCE.CORNER_CLOSEUP.instruction,
  "If you cannot get to it, say so and we will carry on without it.",
].join(" ");

export function isRequiredPhotoType(photoType: PhotoType): boolean {
  return REQUIRED_PHOTO_TYPES.includes(photoType);
}

export function outstandingPhotoTypesFor({
  received,
  requested,
  declined,
}: {
  received: readonly PhotoType[];
  requested: readonly PhotoType[];
  declined: readonly PhotoType[];
}): PhotoType[] {
  const receivedTypes = new Set(received);
  const declinedTypes = new Set(declined);

  const expected: PhotoType[] = [
    ...REQUIRED_PHOTO_TYPES,
    ...requested.filter((type) => !isRequiredPhotoType(type)),
  ];

  return expected.filter(
    (type) => !receivedTypes.has(type) && !declinedTypes.has(type),
  );
}
