import type { BlockVersion, CrmPanelCtx } from "./contracts";
import { resolveBlockCode } from "./resolve-block-code";

import { ME001 } from "../menu/ME001/version";
import { ME002 } from "../menu/ME002/version";
import { ME003 } from "../menu/ME003/version";
import { HE001 } from "../cover/HE001/version";
import { HE002 } from "../cover/HE002/version";
import { HE003 } from "../cover/HE003/version";
import { LO001 } from "../loader/LO001/version";
import { LO002 } from "../loader/LO002/version";
import { LO003 } from "../loader/LO003/version";
import { LC001 } from "../locations/LC001/version";
import { SE001 } from "../services/SE001/version";
import { SP001 } from "../specialists/SP001/version";
import { BO001 } from "../booking/BO001/version";
import { BO002 } from "../booking/BO002/version";
import { AI001 } from "../aisha/AI001/version";
import { AB001 } from "../about/AB001/version";
import { makeGenericVersion } from "./ui/generic-version";
import { HD001 } from "../heading/HD001/version";
import { TX001 } from "../text/TX001/version";
import { IM001 } from "../image/IM001/version";
import { FO001 } from "../form/FO001/version";
import { BT001 } from "../button/BT001/version";
import { AD001 } from "../advantages/AD001/version";
import { FT001 } from "../footer/FT001/version";
import { TM001 } from "../team/TM001/version";
import { NW001 } from "../news/NW001/version";
import { WG001 } from "../widget/WG001/version";
import { WO001 } from "../works/WO001/version";
import { WO002 } from "../works/WO002/version";
import { RV001 } from "../reviews/RV001/version";
import { CT001 } from "../contacts/CT001/version";
import { PM001 } from "../promos/PM001/version";
import { CLL001 } from "../client-login/CLL001/version";
import { CLC001 } from "../client-cabinet/CLC001/version";
import { LP001 } from "../location-profile/LP001/version";
import { SVP001 } from "../service-profile/SVP001/version";
import { SPP001 } from "../specialist-profile/SPP001/version";

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
    case "HE003":
      return HE003;
    case "LO001":
      return LO001;
    case "LO002":
      return LO002;
    case "LO003":
      return LO003;
    case "LC001":
      return LC001;
    case "SE001":
      return SE001;
    case "SP001":
      return SP001;
    case "BO001":
      return BO001;
    case "BO002":
      return BO002;
    case "AI001":
      return AI001;
    case "AB001":
      return AB001;
    case "HD001":
      return HD001;
    case "TX001":
      return TX001;
    case "IM001":
      return IM001;
    case "FO001":
      return FO001;
    case "BT001":
      return BT001;
    case "AD001":
      return AD001;
    case "FT001":
      return FT001;
    case "TM001":
      return TM001;
    case "NW001":
      return NW001;
    case "WG001":
      return WG001;
    case "WO001":
      return WO001;
    case "WO002":
      return WO002;
    case "RV001":
      return RV001;
    case "CT001":
      return CT001;
    case "PM001":
      return PM001;
    case "CLL001":
      return CLL001;
    case "CLC001":
      return CLC001;
    case "LP001":
      return LP001;
    case "SVP001":
      return SVP001;
    case "SPP001":
      return SPP001;
    case "GEN001":
      return makeGenericVersion("GEN001", ctx.block.type, ctx.block.variant);
  }
}
