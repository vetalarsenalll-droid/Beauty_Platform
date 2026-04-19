import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";

export async function GET() {
  const documents = await prisma.platformLegalDocument.findMany({
    include: {
      versions: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return jsonOk({
    documents: documents
      .map((doc) => {
        const version = doc.versions[0];
        if (!version) return null;
        return {
          key: doc.key,
          title: doc.title,
          versionId: version.id,
          url: `/legal/platform/${version.id}`,
        };
      })
      .filter(Boolean),
  });
}
