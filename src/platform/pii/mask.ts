// PII fields are masked by default everywhere: pages, audit before/after values, and logs.

export const PII_FIELDS = ["ssn", "dateOfBirth", "address", "documentNumber"] as const;
export type PiiField = (typeof PII_FIELDS)[number];

export const PII_FIELD_LABELS: Record<PiiField, string> = {
  ssn: "SSN",
  dateOfBirth: "Date of birth",
  address: "Street address",
  documentNumber: "ID document number",
};

export function isPiiField(key: string): key is PiiField {
  return (PII_FIELDS as readonly string[]).includes(key);
}

/** `123-45-6789` -> `***-**-6789` */
export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, "");
  return `***-**-${digits.slice(-4).padStart(4, "*")}`;
}

/** `1990-04-12` -> `**\/**\/1990` */
export function maskDateOfBirth(dob: string): string {
  const year = /\d{4}/.exec(dob)?.[0] ?? "****";
  return `**/**/${year}`;
}

/** `1234 Maple Ave, Springfield, IL 62704` -> `**** ***** ***, Springfield, IL 62704` (street hidden, city kept). */
export function maskAddress(address: string): string {
  const [street, ...rest] = address.split(",");
  const maskedStreet = street.replace(/[^\s]/g, "*");
  return [maskedStreet, ...rest].join(",");
}

/** `P12345678` -> `*****5678` */
export function maskDocumentNumber(value: string): string {
  if (value.length <= 4) return "*".repeat(value.length);
  return "*".repeat(value.length - 4) + value.slice(-4);
}

export function maskPii(field: PiiField, value: string): string {
  switch (field) {
    case "ssn":
      return maskSsn(value);
    case "dateOfBirth":
      return maskDateOfBirth(value);
    case "address":
      return maskAddress(value);
    case "documentNumber":
      return maskDocumentNumber(value);
  }
}

/** Deep-copies a value and masks every PII field it contains, at any depth. */
export function maskRecord<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => maskRecord(item)) as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isPiiField(key) && typeof inner === "string" ? maskPii(key, inner) : maskRecord(inner);
    }
    return out as T;
  }
  return value;
}
