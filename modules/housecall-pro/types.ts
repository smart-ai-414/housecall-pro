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
  addresses: HousecallProAddress[];
}

export interface HousecallProEstimateLineItem {
  service_item_id?: string;
  name: string;
  description?: string;
  quantity: number;
  kind: "labor" | "materials" | "service" | "discount";
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
  line_items: HousecallProEstimateLineItem[];
  note?: string;
  job_fields?: Record<string, unknown>;
}

export interface HousecallProEstimate {
  id: string;
  estimate_number?: string | null;
  work_status?: string | null;
  customer?: HousecallProCustomer | null;
  total_amount?: number | null;
}

export interface HousecallProAttachmentResponse {
  id: string;
  url?: string | null;
}
