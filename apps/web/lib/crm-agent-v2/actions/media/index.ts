import type { CrmAgentActionDefinition } from "../types";
import { mediaArchiveAction } from "./media.archive";
import { mediaCreateCollectionAction } from "./media.create-collection";
import { mediaDeleteCollectionAction } from "./media.delete-collection";
import { mediaLinkToAccountAction } from "./media.link-to-account";
import { mediaLinkToLocationAction } from "./media.link-to-location";
import { mediaLinkToServiceAction } from "./media.link-to-service";
import { mediaLinkToSpecialistAction } from "./media.link-to-specialist";
import { mediaSearchAction } from "./media.search";
import { mediaUnlinkAction } from "./media.unlink";
import { mediaUpdateAltAction } from "./media.update-alt";
import { mediaUpdateCollectionAction } from "./media.update-collection";
import { mediaUpdateMetadataAction } from "./media.update-metadata";
import { mediaUploadAction } from "./media.upload";

export const mediaActions: CrmAgentActionDefinition[] = [
  mediaArchiveAction,
  mediaCreateCollectionAction,
  mediaDeleteCollectionAction,
  mediaLinkToAccountAction,
  mediaLinkToLocationAction,
  mediaLinkToServiceAction,
  mediaLinkToSpecialistAction,
  mediaSearchAction,
  mediaUnlinkAction,
  mediaUpdateAltAction,
  mediaUpdateCollectionAction,
  mediaUpdateMetadataAction,
  mediaUploadAction,
];
