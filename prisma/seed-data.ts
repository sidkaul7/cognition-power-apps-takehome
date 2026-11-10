// Fixed, fake seed data. Content is deterministic; timestamps are offsets from the reset time,
// so the same cases are breached (or not) after every reset.

export const SEED_USERS = [
  { id: "u-ana", name: "Ana Lima", email: "ana.lima@example.com", role: "kyc_analyst" },
  { id: "u-marcus", name: "Marcus Reed", email: "marcus.reed@example.com", role: "compliance_lead" },
  { id: "u-priya", name: "Priya Shah", email: "priya.shah@example.com", role: "support_agent" },
  { id: "u-sam", name: "Sam Park", email: "sam.park@example.com", role: "platform_admin" },
] as const;

const FIRST = ["Olivia", "Noah", "Emma", "Liam", "Sofia", "Mateo", "Hannah", "Lucas", "Amara", "Ethan", "Chloe", "Diego", "Grace", "Omar", "Isla", "Felix", "Nadia", "Victor", "Leila", "Tomas"];
const LAST = ["Bennett", "Okafor", "Lindqvist", "Moreau", "Castillo", "Nakamura", "Petrov", "Haddad", "Fischer", "Romano", "Kowalski", "Adeyemi", "Sullivan", "Varga", "Ibrahim", "Larsen", "Quinn", "Delacroix", "Mensah", "Torres"];
const STREETS = ["Maple Ave", "Oak St", "Cedar Ln", "Harbor Rd", "Willow Way", "Pine Ct", "Elm Dr", "Birch Blvd"];
const CITIES = ["Springfield, IL 62704", "Riverton, WY 82501", "Fairview, OR 97024", "Lakeside, CA 92040", "Greenville, SC 29601", "Madison, WI 53703", "Franklin, TN 37064", "Salem, MA 01970"];
const COUNTRIES = ["United States", "United States", "United States", "Canada", "United Kingdom", "Mexico", "Germany", "Brazil"];
const SOURCES: Record<string, string[]> = {
  sanctions: ["Demo Sanctions List A (fictional)", "Demo Consolidated Sanctions (fictional)"],
  pep: ["Demo PEP Registry (fictional)"],
  adverse_media: ["Demo Adverse Media Index (fictional)"],
};

// Small fixed PRNG so the seed never changes between resets.
function prng(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SeedStatus = "new" | "in_review" | "escalated" | "approved" | "rejected";

export type SeedCase = {
  id: string;
  customerName: string;
  email: string;
  ssn: string;
  dateOfBirth: string;
  address: string;
  country: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  status: SeedStatus;
  assigneeId: string | null;
  hoursAgo: number;
  documents: { id: string; type: string; documentNumber: string; fileName: string }[];
  hits: { id: string; type: string; matchedName: string; sourceList: string; matchScore: number }[];
};

// Cases 0-27 are New and unassigned; the rest show the other statuses.
function statusFor(i: number): { status: SeedStatus; assigneeId: string | null } {
  if (i < 28) return { status: "new", assigneeId: null };
  if (i < 34) return { status: "in_review", assigneeId: "u-ana" };
  if (i < 37) return { status: "escalated", assigneeId: "u-ana" };
  if (i < 39) return { status: "approved", assigneeId: "u-ana" };
  return { status: "rejected", assigneeId: "u-ana" };
}

const BREACHED = new Set([2, 3, 9, 14, 21, 27, 29, 31, 34]);

function hitTypesFor(i: number, risk: string): string[] {
  if (risk === "high" && i % 2 === 0) return i % 4 === 0 ? ["sanctions", "pep"] : ["sanctions"];
  if (risk === "medium" && i % 12 === 1) return ["pep"];
  if (risk === "low" && i % 10 === 5) return ["adverse_media"];
  return [];
}

export function buildSeedCases(): SeedCase[] {
  const rand = prng(20261110);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(list: readonly T[]) => list[int(0, list.length - 1)];

  return Array.from({ length: 40 }, (_, i) => {
    const id = `KYC-${1001 + i}`;
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7 + Math.floor(i / FIRST.length) * 3) % LAST.length];
    const customerName = `${first} ${last}`;
    const riskLevel = (["high", "medium", "low"] as const)[i % 3];
    const riskScore = riskLevel === "high" ? int(70, 98) : riskLevel === "medium" ? int(40, 69) : int(5, 39);
    const year = int(1952, 2001);
    const dateOfBirth = `${year}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
    const ssn = `9${String(int(0, 99)).padStart(2, "0")}-${String(int(10, 99))}-${String(int(1000, 9999))}`;
    const address = `${int(10, 9899)} ${pick(STREETS)}, ${pick(CITIES)}`;
    const docCount = i % 4 === 0 ? 2 : 1;
    const docTypes = ["passport", "drivers_license", "national_id"];
    const documents = Array.from({ length: docCount }, (_, d) => {
      const type = docTypes[(i + d) % 3];
      const prefix = type === "passport" ? "P" : type === "drivers_license" ? "D" : "N";
      return {
        id: `${id}-doc-${d + 1}`,
        type,
        documentNumber: `${prefix}${String(int(1000000, 99999999))}`,
        fileName: `${id.toLowerCase()}-${type.replace("_", "-")}.pdf`,
      };
    });
    const hits = hitTypesFor(i, riskLevel).map((type, h) => ({
      id: `${id}-hit-${h + 1}`,
      type,
      matchedName: h === 0 ? `${first.slice(0, -1)}${first.slice(-1) === "a" ? "ah" : "e"} ${last}` : `${first} ${last.slice(0, 3)}${last.slice(3).toUpperCase()}`,
      sourceList: pick(SOURCES[type]),
      matchScore: type === "adverse_media" ? int(35, 60) : int(55, 97),
    }));
    const hoursAgo = BREACHED.has(i) ? 50 + i * 2 : 1 + ((i * 7) % 44);
    return {
      id,
      customerName,
      email: `${first}.${last}`.toLowerCase() + "@example.com",
      ssn,
      dateOfBirth,
      address,
      country: COUNTRIES[i % COUNTRIES.length],
      riskLevel,
      riskScore,
      ...statusFor(i),
      hoursAgo,
      documents,
      hits,
    };
  });
}
