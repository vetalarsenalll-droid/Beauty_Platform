import type { CrmAgentActionDefinition } from "../types";
import { domainAddAction } from "./domain.add";
import { domainCheckAction } from "./domain.check";
import { domainRemoveAction } from "./domain.remove";
import { domainSearchAction } from "./domain.search";
import { domainSetPrimaryAction } from "./domain.set-primary";
import { domainViewDnsStatusAction } from "./domain.view-dns-status";

export const domainsActions: CrmAgentActionDefinition[] = [
  domainAddAction,
  domainCheckAction,
  domainRemoveAction,
  domainSearchAction,
  domainSetPrimaryAction,
  domainViewDnsStatusAction,
];
