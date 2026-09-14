export interface HousecallProAddress {
  street?: string | null;
  street_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface HousecallProCustomer {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  home_number?: string | null;
  work_number?: string | null;
  company?: string | null;
  addresses?: HousecallProAddress[] | null;
}

export interface HousecallProCustomerListResponse {
  customers?: HousecallProCustomer[] | null;
  total_items?: number | null;
}

export interface HousecallProCreateCustomerRequest {
  first_name: string;
  last_name: string;
  email?: string;
  mobile_number?: string;
  notifications_enabled: boolean;
  lead_source?: string;
  addresses: HousecallProAddress[];
}

export type HousecallProLineItemKind =
  "labor" | "materials" | "discount" | "percent discount" | "tax";

export interface HousecallProEstimateLineItem {
  id?: string | null;
  service_item_id?: string | null;
  service_item_type?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  kind?: HousecallProLineItemKind | string | null;
  unit_of_measure?: string | null;
  order_index?: number | null;
  taxable?: boolean | null;
}

export interface HousecallProEstimateOption {
  id: string;
  name?: string | null;
  option_number?: number | null;
  status?: string | null;
  approval_status?: string | null;
  message_from_pro?: string | null;
  notes?: string | null;
}

export interface HousecallProCreateEstimateOption {
  name: string;
  message_from_pro?: string;
  line_items: HousecallProEstimateLineItem[];
}

export interface HousecallProCreateEstimateRequest {
  customer_id: string;
  address_id?: string;
  schedule?: {
    scheduled_start?: string;
    scheduled_end?: string;
    arrival_window?: number;
  };
  assigned_employee_ids?: string[];
  lead_source?: string;
  options: HousecallProCreateEstimateOption[];
  note?: string;
  job_fields?: Record<string, unknown>;
}

export interface HousecallProEstimate {
  id: string;
  estimate_number?: string | null;
  work_status?: string | null;
  customer?: HousecallProCustomer | null;
  options?: HousecallProEstimateOption[] | null;
}

export interface HousecallProPagedResponse<T> {
  page?: number | null;
  page_size?: number | null;
  total_pages?: number | null;
  total_items?: number | null;
  line_items?: T[] | null;
}

export interface HousecallProCursorResponse<T> {
  object?: string | null;
  data?: T[] | null;
  url?: string | null;
}
