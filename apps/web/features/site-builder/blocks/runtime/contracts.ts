import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type {
  SiteBranding as Branding,
  SiteEditorAccountProfile as AccountProfile,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
} from "@/features/site-builder/shared/site-data";
import type { PanelTheme } from "@/features/site-builder/crm/site-shell-theme";
import type { EditorSection } from "@/features/site-builder/crm/site-client-core";

export type BlockCode =
  | "ME001"
  | "ME002"
  | "ME003"
  | "HE001"
  | "HE002"
  | "LO001"
  | "LO002"
  | "LO003"
  | "BO001"
  | "AI001";

export type BlockVersion = {
  blockCode: BlockCode;
  normalizeData: (input: unknown) => Record<string, unknown>;
  createDefault: (ctx: { accountName: string }) => SiteBlock;
  renderCRM: (ctx: { block: SiteBlock }) => ReactNode;
  renderPublic: (ctx: { block: SiteBlock }) => ReactNode;
  contentPanel: (ctx: CrmPanelCtx) => ReactNode;
  settingsPanel: (ctx: CrmPanelCtx) => ReactNode;
  drawers: (ctx: CrmPanelCtx) => ReactNode;
  actions: (ctx: CrmPanelCtx) => void;
};

export type UpdateBlock = (
  id: string,
  updater: (block: SiteBlock) => SiteBlock,
  options?: { recordHistory?: boolean }
) => void;

export type CrmPanelCtx = {
  rightPanel: "content" | "settings" | null;
  block: SiteBlock;

  accountName: string;
  branding: Branding;
  accountProfile: AccountProfile;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];

  activeTheme: SiteTheme;
  panelTheme: PanelTheme;

  currentPanelSections: EditorSection[];
  activePanelSectionId: string | null;
  setActivePanelSectionId: Dispatch<SetStateAction<string | null>>;

  coverDrawerKey: "slider" | "typography" | "button" | "animation" | null;
  setCoverDrawerKey: Dispatch<SetStateAction<"slider" | "typography" | "button" | "animation" | null>>;

  coverWidthButtonRef: RefObject<HTMLButtonElement | null>;
  coverWidthPopoverRef: RefObject<HTMLDivElement | null>;
  coverWidthModalOpen: boolean;
  setCoverWidthModalOpen: Dispatch<SetStateAction<boolean>>;

  updateBlock: UpdateBlock;
};
