"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VatRow } from "../lib/vat/types";
import { guessCountryCode, normalizeVat, stripCountryPrefix } from "../lib/vat/utils";

type ApiHealth = { ok: boolean; ts?: number; ms?: number; mode?: string };

const DEFAULT_BATCH = `NL999999999B99
DE123456789
FR12345678901`;

function splitLines(text: string) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: VatRow[]) {
  const headers: (keyof VatRow | string)[] = [
    "input",
    "vat_number",
    "country_code",
    "vat_part",
    "valid",
    "name",
    "address",
    "state",
    "error",
    "source",
    "request_id",
    "ts_created",
    "ts_updated",
  ];

  const esc = (v: any) => {
    const s = v === undefined || v === null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {}
    throw new Error(msg);
  }

  return (await res.json()) as T;
}

function Badge({
  children,
  kind = "muted",
}: {
  children: React.ReactNode;
  kind?: "ok" | "warn" | "err" | "muted";
}) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs";
  const styles: Record<string, string> = {
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    err: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200",
    muted:
      "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
  };
  return <span className={`${base} ${styles[kind]}`}>{children}</span>;
}

function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb);
  ref.current = cb;

  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export default function VatCheckerClient() {
  const [mode, setMode] = useState<"single" | "batch">("batch");
  const [inputVat, setInputVat] = useState("NL999999999B99");
  const [batchText, setBatchText] = useState(DEFAULT_BATCH);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<VatRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState(false);

  const batchList = useMemo(
    () => splitLines(batchText).map((v) => normalizeVat(v)),
    [batchText]
  );

  async function refreshHealth() {
    try {
      const h = await apiGet<ApiHealth>("/api/health");
      setHealth(h);
    } catch {
      setHealth({ ok: false });
    }
  }

  async function refreshQueue() {
    try {
      const r = await apiGet<{ ok: boolean; results?: VatRow[] }>("/api/queue");
      setRows(r?.results ?? []);
    } catch {}
  }

  useEffect(() => {
    void refreshHealth();
    void refreshQueue();
  }, []);

  useInterval(() => {
    if (!poll) return;
    void refreshHealth();
    void refreshQueue();
  }, poll ? 2000 : null);

  async function validateSingle() {
    setBusy(true);
    setError(null);
    try {
      const vat = normalizeVat(inputVat);
      const country = guessCountryCode(vat);
      const vat_part = stripCountryPrefix(vat);

      const resp = await apiPost<{ ok: boolean; result: VatRow }>("/api/validate", {
        vat_number: vat,
        country_code: country,
        vat_part,
      });

      setRows([resp.result]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function validateBatch() {
    setBusy(true);
    setError(null);
    try {
      const payload = batchList
        .filter(Boolean)
        .map((vat) => ({
          input: vat,
          vat_number: vat,
          country_code: guessCountryCode(vat),
          vat_part: stripCountryPrefix(vat),
        }));

      const resp = await apiPost<{ ok: boolean; results: VatRow[]; queued?: number }>(
        "/api/validate-batch",
        { items: payload }
      );

      setRows(resp.results ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearQueue() {
    setBusy(true);
    setError(null);
    try {
      await apiPost<{ ok: boolean }>("/api/queue/clear", {});
      setRows([]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((r) => r.valid === true).length;
    const invalid = rows.filter((r) => r.valid === false).length;
    const unknown = rows.filter((r) => r.valid == null).length;
    const processing = rows.filter((r) => r.state === "processing" || r.state === "queued").length;
    const errors = rows.filter((r) => r.state === "error" || r.error).length;
    return { total, valid, invalid, unknown, processing, errors };
  }, [rows]);

  return (
    <section className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">VAT checker</h1>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            API:{" "}
            <Badge kind={health?.ok ? "ok" : "err"}>{health?.ok ? "up" : "down"}</Badge>
            {health?.mode ? <span className="ml-2 opacity-80">mode: {health.mode}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={poll}
              onChange={(e) => setPoll(e.target.checked)}
              className="h-4 w-4"
            />
            poll
          </label>

          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
            onClick={refreshQueue}
            disabled={busy}
          >
            refresh
          </button>

          <button
            className="rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-200 disabled:opacity-50"
            onClick={clearQueue}
            disabled={busy}
          >
            clear queue
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Input */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-black">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-gray-900 dark:text-white">Input</div>
            <div className="inline-flex overflow-hidden rounded-lg border dark:border-gray-800">
              <button
                className={`px-3 py-1.5 text-sm ${
                  mode === "single"
                    ? "bg-blue-500/10 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-300"
                }`}
                onClick={() => setMode("single")}
              >
                single
              </button>
              <button
                className={`px-3 py-1.5 text-sm ${
                  mode === "batch"
                    ? "bg-blue-500/10 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-300"
                }`}
                onClick={() => setMode("batch")}
              >
                batch
              </button>
            </div>
          </div>

          <div className="mt-4">
            {mode === "single" ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">VAT number</label>
                <input
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-mono dark:border-gray-800"
                  value={inputVat}
                  onChange={(e) => setInputVat(e.target.value)}
                  placeholder="NL999999999B99"
                />
                <button
                  className="mt-2 rounded-lg border bg-blue-500/10 px-3 py-2 text-sm hover:bg-blue-500/15 disabled:opacity-50"
                  onClick={validateSingle}
                  disabled={busy}
                >
                  validate
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">
                  VAT numbers (one per line)
                </label>
                <textarea
                  className="min-h-[220px] w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm font-mono dark:border-gray-800"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  rows={10}
                />
                <button
                  className="mt-2 rounded-lg border bg-blue-500/10 px-3 py-2 text-sm hover:bg-blue-500/15 disabled:opacity-50"
                  onClick={validateBatch}
                  disabled={busy}
                >
                  validate batch
                </button>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  Parsed: <b>{batchList.filter(Boolean).length}</b>
                </div>
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                <b>Error</b>
                <div className="mt-1">{error}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-black lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium text-gray-900 dark:text-white">Results</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>total {stats.total}</Badge>
              <Badge kind="ok">valid {stats.valid}</Badge>
              <Badge kind="err">invalid {stats.invalid}</Badge>
              <Badge kind="warn">unknown {stats.unknown}</Badge>
              <Badge>processing {stats.processing}</Badge>
              <Badge kind="err">errors {stats.errors}</Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
              onClick={() => downloadJson("vat-results.json", rows)}
              disabled={!rows.length}
            >
              export json
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
              onClick={() => downloadCsv("vat-results.csv", rows)}
              disabled={!rows.length}
            >
              export csv
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
              onClick={refreshQueue}
              disabled={busy}
            >
              refresh queue
            </button>
          </div>

          <div className="mt-3 overflow-auto rounded-xl border dark:border-gray-800">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-black">
                <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                  <th className="p-3">input</th>
                  <th className="p-3">vat_number</th>
                  <th className="p-3">valid</th>
                  <th className="p-3">name</th>
                  <th className="p-3">address</th>
                  <th className="p-3">state</th>
                  <th className="p-3">error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.request_id ?? `${r.vat_number}-${i}`} className="border-t dark:border-gray-800">
                    <td className="p-3 font-mono">{r.input ?? ""}</td>
                    <td className="p-3 font-mono">{r.vat_number ?? ""}</td>
                    <td className="p-3">
                      {r.valid === true ? (
                        <Badge kind="ok">valid</Badge>
                      ) : r.valid === false ? (
                        <Badge kind="err">invalid</Badge>
                      ) : (
                        <Badge kind="warn">unknown</Badge>
                      )}
                    </td>
                    <td className="p-3">{r.name ?? ""}</td>
                    <td className="p-3 whitespace-pre-wrap">{r.address ?? ""}</td>
                    <td className="p-3 font-mono">{r.state ?? ""}</td>
                    <td className="p-3 font-mono">{r.error ?? ""}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-sm text-gray-600 dark:text-gray-300">
                      no results
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            Tip: zet poll aan om queue-updates te zien.
          </div>
        </div>
      </div>
    </section>
  );
}
