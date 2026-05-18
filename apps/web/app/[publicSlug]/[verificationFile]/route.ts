import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePublicSlugId } from "@/lib/public-slug";
import {
  mergeVerificationHtmlFiles,
  normalizeVerificationHtmlContent,
  normalizeVerificationHtmlFilename,
} from "@/lib/seo-verification";

type RouteContext = {
  params: Promise<{ publicSlug?: string; verificationFile?: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const publicSlug = params.publicSlug ?? "";
  const requestedFile = normalizeVerificationHtmlFilename(params.verificationFile);
  const parsed = parsePublicSlugId(publicSlug);

  if (!parsed || !requestedFile) {
    return new NextResponse("not found", { status: 404 });
  }

  const seo = await prisma.seoSetting.findUnique({
    where: { accountId: parsed.id },
    select: {
      verificationHtmlFilename: true,
      verificationHtmlContent: true,
      verificationHtmlFiles: true,
    },
  });

  const file = mergeVerificationHtmlFiles(
    seo?.verificationHtmlFiles,
    seo?.verificationHtmlFilename,
    seo?.verificationHtmlContent
  ).find((item) => item.filename === requestedFile);
  const content = normalizeVerificationHtmlContent(
    file?.content
  );

  if (!file || !content) {
    return new NextResponse("not found", { status: 404 });
  }

  return new NextResponse(content, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
