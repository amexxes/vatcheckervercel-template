const VIES_URL =
  "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function pickTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
    "i"
  );
  const m = xml.match(re);
  return m ? decodeXml(m[1].trim()) : null;
}

export async function checkVatVies(countryCode: string, vatNumber: string) {
  // VIES gebruikt EL voor Griekenland (i.p.v. GR)
  const cc = (countryCode ?? "").toUpperCase() === "GR" ? "EL" : (countryCode ?? "").toUpperCase();
  const vn = String(vatNumber ?? "").replace(/\s+/g, "");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${cc}</urn:countryCode>
      <urn:vatNumber>${vn}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

  const r = await fetch(VIES_URL, {
    method: "POST",
    headers: {
      "content-type": "text/xml; charset=utf-8",
      "cache-control": "no-store",
    },
    body,
  });

  const text = await r.text();

  // SOAP fault?
  const fault = pickTag(text, "faultstring");
  if (!r.ok) throw new Error(`VIES ${r.status} ${r.statusText}`);
  if (fault) throw new Error(fault);

  const validRaw = pickTag(text, "valid");
  const valid =
    validRaw?.toLowerCase() === "true"
      ? true
      : validRaw?.toLowerCase() === "false"
        ? false
        : null;

  return {
    valid,
    name: pickTag(text, "name") ?? "",
    address: pickTag(text, "address") ?? "",
  };
}
