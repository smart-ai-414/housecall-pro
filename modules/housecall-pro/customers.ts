import { normalizePhone } from "@/core/utils/format";
import type { HousecallProClient } from "@/modules/housecall-pro/client";
import { HousecallProError } from "@/modules/housecall-pro/errors";
import { applyTestPrefix } from "@/modules/housecall-pro/test-guard";
import type {
  HousecallProCreateCustomerRequest,
  HousecallProCustomer,
  HousecallProCustomerListResponse,
} from "@/modules/housecall-pro/types";

const CUSTOMERS_PATH = "customers";
const SEARCH_PAGE_SIZE = 25;

export type CustomerMatchKey = "PHONE" | "EMAIL";

export interface CustomerMatch {
  customer: HousecallProCustomer;
  matchedOn: CustomerMatchKey;
}

export interface CustomerIdentity {
  name: string | null;
  phone: string | null;
  email: string | null;
  serviceAddress: string | null;
}

function customerPhoneNumbers(customer: HousecallProCustomer): string[] {
  return [customer.mobile_number, customer.home_number, customer.work_number]
    .filter((value): value is string => typeof value === "string")
    .map(normalizePhone)
    .filter((value) => value.length > 0);
}

async function searchCustomers(
  client: HousecallProClient,
  query: string,
): Promise<HousecallProCustomer[]> {
  const response = await client.request<HousecallProCustomerListResponse>({
    method: "GET",
    path: CUSTOMERS_PATH,
    query: { q: query, page_size: SEARCH_PAGE_SIZE },
  });

  return response.customers ?? [];
}

export async function findCustomerByPhone(
  client: HousecallProClient,
  phone: string,
): Promise<HousecallProCustomer | null> {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return null;

  const candidates = await searchCustomers(client, normalized);

  return (
    candidates.find((candidate) =>
      customerPhoneNumbers(candidate).includes(normalized),
    ) ?? null
  );
}

export async function findCustomerByEmail(
  client: HousecallProClient,
  email: string,
): Promise<HousecallProCustomer | null> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return null;

  const candidates = await searchCustomers(client, normalized);

  return (
    candidates.find(
      (candidate) => candidate.email?.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export async function findExistingCustomer(
  client: HousecallProClient,
  identity: CustomerIdentity,
): Promise<CustomerMatch | null> {
  if (identity.phone) {
    const byPhone = await findCustomerByPhone(client, identity.phone);
    if (byPhone) return { customer: byPhone, matchedOn: "PHONE" };
  }

  if (identity.email) {
    const byEmail = await findCustomerByEmail(client, identity.email);
    if (byEmail) return { customer: byEmail, matchedOn: "EMAIL" };
  }

  return null;
}

export function splitCustomerName(fullName: string | null): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (fullName ?? "").trim();
  if (trimmed.length === 0) {
    return { firstName: "Website", lastName: "Enquiry" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "—" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

const ADDRESS_PATTERN =
  /^(?<street>.+?),\s*(?<city>[^,]+),\s*(?<state>[A-Za-z]{2})\s+(?<zip>\d{5})(?:-\d{4})?$/;

export function parseServiceAddress(
  address: string | null,
): HousecallProCreateCustomerRequest["addresses"] {
  if (!address) return [];

  const match = ADDRESS_PATTERN.exec(address.trim());

  if (!match?.groups) {
    return [{ street: address.trim() }];
  }

  return [
    {
      street: match.groups.street.trim(),
      city: match.groups.city.trim(),
      state: match.groups.state.toUpperCase(),
      zip: match.groups.zip,
    },
  ];
}

export async function createCustomer(
  client: HousecallProClient,
  identity: CustomerIdentity,
  idempotencyKey: string,
): Promise<HousecallProCustomer> {
  const { firstName, lastName } = splitCustomerName(identity.name);
  const normalizedPhone = identity.phone
    ? normalizePhone(identity.phone)
    : null;

  const payload: HousecallProCreateCustomerRequest = {
    first_name: applyTestPrefix(firstName),
    last_name: lastName,
    notifications_enabled: false,
    addresses: parseServiceAddress(identity.serviceAddress),
    ...(identity.email ? { email: identity.email } : {}),
    ...(normalizedPhone ? { mobile_number: normalizedPhone } : {}),
  };

  return client.request<HousecallProCustomer>({
    method: "POST",
    path: CUSTOMERS_PATH,
    body: payload,
    idempotencyKey,
    attemptLimit: 1,
  });
}

export interface ResolvedCustomer {
  customerId: string;
  wasCreated: boolean;
  matchedOn: CustomerMatchKey | null;
}

export async function resolveCustomer(
  client: HousecallProClient,
  identity: CustomerIdentity,
  idempotencyKey: string,
): Promise<ResolvedCustomer> {
  const existing = await findExistingCustomer(client, identity);

  if (existing) {
    return {
      customerId: existing.customer.id,
      wasCreated: false,
      matchedOn: existing.matchedOn,
    };
  }

  const created = await createCustomer(client, identity, idempotencyKey);

  if (!created?.id) {
    throw new HousecallProError({
      kind: "UNEXPECTED_RESPONSE",
      message: "Customer creation returned no id",
    });
  }

  return { customerId: created.id, wasCreated: true, matchedOn: null };
}
