import type { CrmAgentActionDefinition } from "../types";
import { legalArchiveDocumentAction } from "./legal.archive-document";
import { legalCheckMissingAcceptancesAction } from "./legal.check-missing-acceptances";
import { legalCreateDocumentAction } from "./legal.create-document";
import { legalPublishVersionAction } from "./legal.publish-version";
import { legalUpdateDocumentAction } from "./legal.update-document";
import { legalViewAcceptancesAction } from "./legal.view-acceptances";
import { legalViewDocumentsAction } from "./legal.view-documents";

export const legalActions: CrmAgentActionDefinition[] = [
  legalArchiveDocumentAction,
  legalCheckMissingAcceptancesAction,
  legalCreateDocumentAction,
  legalPublishVersionAction,
  legalUpdateDocumentAction,
  legalViewAcceptancesAction,
  legalViewDocumentsAction,
];
