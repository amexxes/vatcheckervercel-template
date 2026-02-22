export type VatRow = {
  input?: string;
  source?: string;
  state?: string; // valid/invalid/queued/retry/processing/error
  vat_number?: string;
  country_code?: string;
  vat_part?: string;
  valid?: boolean | null;
  name?: string;
  address?: string;
  request_id?: string;
  error?: string;
  ts_created?: number;
  ts_updated?: number;
};
