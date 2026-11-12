export const jobCategories = ["build", "apply", "lead"] as const;
export const jobFunctions = [
  "product",
  "engineering",
  "data",
  "design",
  "marketing",
  "operations",
] as const;
export const remoteStatuses = ["onsite", "hybrid", "remote"] as const;
export const seniorityLevels = ["junior", "mid", "senior", "lead"] as const;
export const contractTypes = ["employment", "b2b", "mandate"] as const;
export const publicationStatuses = [
  "draft",
  "review",
  "published",
  "hidden",
  "expired",
  "archived",
] as const;

export type JobCategory = (typeof jobCategories)[number];
export type JobFunction = (typeof jobFunctions)[number];
export type RemoteStatus = (typeof remoteStatuses)[number];
export type SeniorityLevel = (typeof seniorityLevels)[number];
export type ContractType = (typeof contractTypes)[number];
export type PublicationStatus = (typeof publicationStatuses)[number];

export type Company = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  websiteUrl: string;
  location: string;
  sizeLabel: string;
  logoUrl?: string;
};

export type JobRequirement = {
  id: string;
  text: string;
  assessment?: { verdict: "concrete" | "generic"; note: string; suggestion?: string };
};

export type Job = {
  id: string;
  slug: string;
  companyId: string;
  title: string;
  summary: string;
  description: string;
  category: JobCategory;
  function: JobFunction;
  remoteStatus: RemoteStatus;
  locations: string[];
  coordinates?: { latitude: number; longitude: number };
  seniority: SeniorityLevel;
  contract: ContractType;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: "PLN" | "EUR";
  salaryPeriod?: "month" | "year";
  salaryKind?: "gross" | "net";
  publicationStatus: PublicationStatus;
  publishedAt: string;
  expiryAt: string;
  verificationStatus: "unverified" | "editorial" | "employer_verified";
  /** Tylko nowe ogłoszenia (od listopada 2026): 3–5 wymagań z przykładem kandydata. */
  requirements?: JobRequirement[];
};

export type JobWithCompany = Job & { company: Company };

export type JobFilters = {
  category?: JobCategory;
  function?: JobFunction;
  remote?: RemoteStatus;
  seniority?: SeniorityLevel;
  contract?: ContractType;
  location?: string;
  query?: string;
  page: number;
};
