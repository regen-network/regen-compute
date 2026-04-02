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
  /** Image intrinsic width (for CLS prevention) */
  imageWidth: number;
  /** Image intrinsic height (for CLS prevention) */
  imageHeight: number;
  /** SEO-optimized alt text (includes credit type and location) */
  imageAlt: string;
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
      'El Globo is located in the "Cuchilla Jardin-Tamesis" Integrated Management District (DMI). Here ecosystem preservation, forest enhancement and restoration activities are implemented to generate positive and permanent impacts on biodiversity.',
    location: "Antioquia, Colombia",
    imageUrl: "/projects/el-globo.webp",
    projectPageUrl: "https://app.regen.network/project/BT01-001",
    accentColor: "#527984",
    imageWidth: 960, imageHeight: 1440,
    imageAlt: "El Globo Habitat Bank — biodiversity credits, Antioquia, Colombia",
  },
  {
    projectId: "USS01-002",
    creditClassId: "USS01",
    creditType: "USS",
    creditTypeLabel: "Species Stewardship",
    name: "Biocultural Jaguar Credits, Ancestral Stewardship in the Sharamentsa Community",
    description:
      "In the Amazon headwaters, Indigenous stewards face increasing pressure from activities like illegal logging and mining, which endanger both their forest ecosystem and cultural heritage. The Sharamentsa community, belonging to the Achuar Nation, is pivotal in this biodiversity project that focuses on safeguarding a critical 10,000-hectare jaguar habitat.",
    location: "Pastaza Province, Ecuador",
    imageUrl: "/projects/jaguar.webp",
    projectPageUrl: "https://app.regen.network/project/USS01-002",
    accentColor: "#7c3aed",
    imageWidth: 960, imageHeight: 640,
    imageAlt: "Biocultural Jaguar Credits — umbrella species stewardship, Sharamentsa Community, Ecuador",
  },
  {
    projectId: "C02-004",
    creditClassId: "C02",
    creditType: "C",
    creditTypeLabel: "Carbon",
    name: "Harvey Manning Park Expansion",
    description:
      'The 15.14 acre Harvey Manning Park Expansion project is part of 33 acres in the "Issaquah Alps" comprised of Tiger, Squak, and Cougar Mountains, above Lake Sammamish. The 100+ year old forest includes riparian and wetland habitat that supports wildlife corridors on Cougar Mountain and protects cool freshwater streams that feed Tibbetts Creek, a salmon-bearing tributary to Lake Sammamish.',
    location: "Issaquah, Washington",
    imageUrl: "/projects/harvey-manning.webp",
    projectPageUrl: "https://app.regen.network/project/C02-004",
    accentColor: "#4FB573",
    imageWidth: 960, imageHeight: 720,
    imageAlt: "Harvey Manning Park Expansion — carbon credits, old-growth forest, Issaquah, Washington",
  },
  {
    projectId: "C02-006",
    creditClassId: "C02",
    creditType: "C",
    creditTypeLabel: "Carbon",
    name: "St. Elmo Preservation Project",
    description:
      "Lookout Mountain is one of the most biologically diverse and critically imperiled ecoregions in the world stretching 90+ miles across three states; Tennessee, Alabama, and Georgia. The 58 acre oak-pine forest is situated between the Chickamauga & Chattanooga National Military Park and the historic St. Elmo neighborhood. By protecting this property, the Conservancy ensures connectivity between habitat corridors and provides essential wildlife habitat for several species.",
    location: "Chattanooga, Tennessee",
    imageUrl: "/projects/st-elmo.webp",
    projectPageUrl: "https://app.regen.network/project/C02-006",
    accentColor: "#4FB573",
    imageWidth: 960, imageHeight: 1440,
    imageAlt: "St. Elmo Preservation Project — carbon credits, oak-pine forest, Chattanooga, Tennessee",
  },
  {
    projectId: "C06-002",
    creditClassId: "C06",
    creditType: "C",
    creditTypeLabel: "Carbon",
    name: "Pimlico Farm",
    description:
      "The primary indicator in this credit class is soil organic carbon stocks (SOCS). Levels will be increased by growing harvestable and cover crops and grass to maximise canopy and root growth while incorporating crop residues and manures. Reduced soil disturbance, maintaining soil cover and returning crop residues will maximise retained organic matter in the soil.",
    location: "Oxfordshire, United Kingdom",
    imageUrl: "/projects/pimlico.webp",
    projectPageUrl: "https://app.regen.network/project/C06-002",
    accentColor: "#4FB573",
    imageWidth: 960, imageHeight: 540,
    imageAlt: "Pimlico Farm — soil carbon credits, regenerative agriculture, Oxfordshire, United Kingdom",
  },
  {
    projectId: "KSH01-001",
    creditClassId: "KSH01",
    creditType: "KSH",
    creditTypeLabel: "Regenerative Grazing",
    name: "Grgich Hills Estate Regenerative Sheep Grazing",
    description:
      "This project uses high-density, short-duration rotational sheep grazing in vineyard systems to improve ecosystem functioning through active management of the soil and herbaceous cover in the vineyard understory. The practice improves soil health, reduces use of herbicides or mowing, and enhances carbon storage.",
    location: "Napa Valley, California",
    imageUrl: "/projects/grgich-hills.webp",
    projectPageUrl: "https://app.regen.network/project/KSH01-001",
    accentColor: "#a3785c",
    imageWidth: 960, imageHeight: 640,
    imageAlt: "Grgich Hills Estate — regenerative sheep grazing credits, Napa Valley, California",
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
