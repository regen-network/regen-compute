/**
 * Hardcoded metadata for the 6 projects in the monthly credit rotation.
 *
 * We hardcode this rather than fetching at runtime because:
 * 1. The project set is fixed (6 projects)
 * 2. Descriptions and images rarely change
 * 3. Avoids runtime GraphQL/S3 dependencies for the dashboard
 *
 * Images are sourced from regen-registry.s3.amazonaws.com (the same S3
 * bucket used by app.regen.network project pages).
 */

export interface ProjectInfo {
  /** On-chain project ID (e.g. "C02-004") */
  projectId: string;
  /** Credit class ID (e.g. "C02") */
  creditClassId: string;
  /** Credit type abbreviation */
  creditType: "C" | "BT" | "USS" | "KSH";
  /** Credit type display label */
  creditTypeLabel: string;
  /** Human-readable project name */
  name: string;
  /** Short 1-2 sentence description */
  description: string;
  /** Location string */
  location: string;
  /** Hero image URL */
  imageUrl: string;
  /** app.regen.network project page URL */
  projectPageUrl: string;
  /** Color accent for the credit type badge */
  accentColor: string;
}

/**
 * All 6 projects in the monthly rotation, keyed by batch denom prefix.
 * Use getProjectForBatch() to look up by full batch denom.
 */
export const PROJECTS: ProjectInfo[] = [
  {
    projectId: "BT01-001",
    creditClassId: "BT01",
    creditType: "BT",
    creditTypeLabel: "Biodiversity",
    name: "El Globo Habitat Bank",
    description:
      "A habitat bank in Antioquia, Colombia that protects and restores critical biodiversity corridors through Terrasos' pioneering framework for conservation banking.",
    location: "Antioquia, Colombia",
    imageUrl:
      "https://regen-registry.s3.amazonaws.com/projects/146f8ea0-c484-11ee-9ebb-0a6e1e09fcad/1707323979494-MONTA%C3%91AS.jpg",
    projectPageUrl: "https://app.regen.network/project/BT01-001",
    accentColor: "#527984",
  },
  {
    projectId: "USS01-002",
    creditClassId: "USS01",
    creditType: "USS",
    creditTypeLabel: "Species Stewardship",
    name: "Biocultural Jaguar Credits",
    description:
      "Indigenous stewards of the Sharamentsa community in Ecuador's Amazon protect 10,000 hectares of critical jaguar habitat through ancestral forest stewardship.",
    location: "Pastaza Province, Ecuador",
    imageUrl:
      "https://regen-registry.s3.amazonaws.com/projects/31f91f8c-8fd1-11ee-ba15-0267c2be097b/1732744057255-Jaguar_2023_RM_2.jpg",
    projectPageUrl: "https://app.regen.network/project/USS01-002",
    accentColor: "#7c3aed",
  },
  {
    projectId: "C02-004",
    creditClassId: "C02",
    creditType: "C",
    creditTypeLabel: "Carbon",
    name: "Harvey Manning Park Expansion",
    description:
      "Urban forest carbon credits from a park expansion in Issaquah, Washington, protecting native forest canopy in a rapidly developing area near Seattle.",
    location: "Issaquah, Washington",
    imageUrl:
      "https://regen-registry.s3.amazonaws.com/projects/C02/harvey-manning-01.jpg",
    projectPageUrl: "https://app.regen.network/project/C02-004",
    accentColor: "#4FB573",
  },
  {
    projectId: "C02-006",
    creditClassId: "C02",
    creditType: "C",
    creditTypeLabel: "Carbon",
    name: "St. Elmo Preservation",
    description:
      "Urban forest carbon credits from a preservation effort in Chattanooga, Tennessee, protecting mature tree canopy that provides critical ecosystem services to the local community.",
    location: "Chattanooga, Tennessee",
    imageUrl:
      "https://regen-registry.s3.amazonaws.com/projects/1f484f70-16cd-11ee-ab29-0a6e1e09fcad/1688575971540-Photo%20Oct%2023,%2011%2015%2024%20AM.jpg",
    projectPageUrl: "https://app.regen.network/project/C02-006",
    accentColor: "#4FB573",
  },
  {
    projectId: "C06-002",
    creditClassId: "C06",
    creditType: "C",
    creditTypeLabel: "Carbon",
    name: "Pimlico Farm",
    description:
      "Regenerative agriculture on managed cropland and grassland in the UK, building soil carbon through improved land management practices.",
    location: "Oxfordshire, United Kingdom",
    imageUrl:
      "https://regen-registry.s3.amazonaws.com/projects/8cb44ebc-e532-11ef-8178-0afffa81c869/1738925262683-4.jpeg",
    projectPageUrl: "https://app.regen.network/project/C06-002",
    accentColor: "#4FB573",
  },
  {
    projectId: "KSH01-001",
    creditClassId: "KSH01",
    creditType: "KSH",
    creditTypeLabel: "Regenerative Grazing",
    name: "Grgich Hills Sheep Grazing",
    description:
      "Kilo-Sheep-Hour credits from regenerative vineyard grazing in Napa Valley. Sheep replace herbicides and machinery, building soil health while producing world-class wine.",
    location: "Napa Valley, California",
    imageUrl:
      "https://regen-registry.s3.amazonaws.com/projects/d1a8c4ec-4cf6-11ee-9623-0a6e1e09fcad/1694034028766-grgich1.jpg",
    projectPageUrl: "https://app.regen.network/project/KSH01-001",
    accentColor: "#a3785c",
  },
];

/** Look up project metadata by batch denom (e.g. "C02-004-20210102-20211207-001") */
export function getProjectForBatch(batchDenom: string): ProjectInfo | undefined {
  // Extract project ID from batch denom: "C02-004-20210102-..." → "C02-004"
  // Handle different patterns: "BT01-001-...", "USS01-002-...", "KSH01-001-..."
  for (const project of PROJECTS) {
    if (batchDenom.startsWith(project.projectId)) {
      return project;
    }
  }
  return undefined;
}

/** Get all projects as a map keyed by credit class ID */
export function getProjectsByCreditClass(): Map<string, ProjectInfo> {
  const map = new Map<string, ProjectInfo>();
  for (const p of PROJECTS) {
    map.set(p.creditClassId, p);
  }
  return map;
}
