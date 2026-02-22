import type { VatRow } from "./types";

function now() {
  return Date.now();
}

export function normalizeVat(input: unknown) {
  const s = String(input ?? "").toUpperCase().replace(/\s+/g, "").trim();
  if (!s) return "";
  return s.replace(/[^A-Z0-9]/g, "");
}

export function guessCountryCode(vat: string) {
  const m = vat.match(/^([A-Z]{2})/);
  return m?.[1] ?? "";
}

export function stripCountryPrefix(vat: string) {
  return vat.replace(/^[A-Z]{2}/, "");
}

export function makeRequestId() {
  return `req_${now()}_${Math.random().toString(16).slice(2)}`;
}

export function makeQueuedRow(input: any, sourceDefault: string): VatRow {
  const vat = normalizeVat(input?.vat_number ?? input?.input);
  const country = String(input?.country_code ?? guessCountryCode(vat)).toUpperCase();
  const vat_part = String(input?.vat_part ?? stripCountryPrefix(vat));

  return {
    input: input?.input ?? vat,
    source: input?.source ?? sourceDefault,
    state: "queued",
    vat_number: vat,
    country_code: country,
    vat_part,
    valid: null,
    name: "",
    address: "",
    error: "",
    request_id: makeRequestId(),
    ts_created: now(),
    ts_updated: now(),
  };
}
