import type { BlockVersion, CrmPanelCtx } from "./contracts";
import { resolveBlockCode } from "./resolve-block-code";

import { ME001 } from "../menu/ME001/version";
import { ME002 } from "../menu/ME002/version";
import { ME003 } from "../menu/ME003/version";
import { HE001 } from "../cover/HE001/version";
import { HE002 } from "../cover/HE002/version";
import { LO001 } from "../loader/LO001/version";
import { LO002 } from "../loader/LO002/version";
import { LO003 } from "../loader/LO003/version";
import { BO001 } from "../booking/BO001/version";
import { AI001 } from "../aisha/AI001/version";

export function resolveBlockVersion(ctx: Pick<CrmPanelCtx, "block">): BlockVersion {
  const code = resolveBlockCode(ctx.block);
  switch (code) {
    case "ME001":
      return ME001;
    case "ME002":
      return ME002;
    case "ME003":
      return ME003;
    case "HE001":
      return HE001;
    case "HE002":
      return HE002;
    case "LO001":
      return LO001;
    case "LO002":
      return LO002;
    case "LO003":
      return LO003;
    case "BO001":
      return BO001;
    case "AI001":
      return AI001;
  }
}
