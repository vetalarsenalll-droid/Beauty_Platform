import fs from "node:fs";
import path from "node:path";
import { PrismaClient, BusinessType } from "@prisma/client";

function loadDotEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;

  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvIfNeeded();

const prisma = new PrismaClient();

function readCatalogKeysFromMarkdown(markdown) {
  const keys = new Set();
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const entryMatch = line.match(/^\d+\.\s+.+\s+—\s+`([A-Z_]+)`\s*$/);
    if (entryMatch) {
      keys.add(entryMatch[1]);
    }
  }

  return [...keys];
}

async function main() {
  const markdownPath = path.resolve("docs/SERVICE_CATALOG_MASTER.md");
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const catalogKeys = readCatalogKeysFromMarkdown(markdown);
  const enumKeys = Object.values(BusinessType);

  const catalogSet = new Set(catalogKeys);
  const enumSet = new Set(enumKeys);

  const missingInCatalog = enumKeys.filter((key) => !catalogSet.has(key));
  const unknownInCatalog = catalogKeys.filter((key) => !enumSet.has(key));

  const accountTypes = await prisma.account.findMany({
    where: { businessType: { not: null } },
    select: { businessType: true },
  });

  const usedKeys = [...new Set(accountTypes.map((item) => item.businessType).filter(Boolean))];
  const usedMissingInCatalog = usedKeys.filter((key) => !catalogSet.has(key));
  const usedMissingInEnum = usedKeys.filter((key) => !enumSet.has(key));

  const hasIssues =
    missingInCatalog.length > 0 ||
    unknownInCatalog.length > 0 ||
    usedMissingInCatalog.length > 0 ||
    usedMissingInEnum.length > 0;

  if (hasIssues) {
    console.error("Business catalog compatibility check failed.");
    if (missingInCatalog.length) {
      console.error("Missing in SERVICE_CATALOG_MASTER.md:", missingInCatalog);
    }
    if (unknownInCatalog.length) {
      console.error("Unknown keys in SERVICE_CATALOG_MASTER.md:", unknownInCatalog);
    }
    if (usedMissingInCatalog.length) {
      console.error("Used account businessType missing in catalog:", usedMissingInCatalog);
    }
    if (usedMissingInEnum.length) {
      console.error("Used account businessType missing in enum:", usedMissingInEnum);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Business catalog compatibility: OK");
  console.log("Enum keys:", enumKeys.length);
  console.log("Catalog keys:", catalogKeys.length);
  console.log("Used account keys:", usedKeys.length);
}

main()
  .catch((error) => {
    console.error("Business catalog compatibility check crashed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
