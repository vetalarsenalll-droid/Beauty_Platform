import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type {
  SiteBookingSettings as BookingSettings,
  SiteBranding as Branding,
  SiteEditorAccountProfile as AccountProfile,
  SiteEditableLegalDocumentItem as EditableLegalDocumentItem,
  SiteLegalDocumentItem as LegalDocumentItem,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceCategoryItem as ServiceCategoryItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistLevelItem as SpecialistLevelItem,
  SiteSpecialistItem as SpecialistItem,
} from "@/features/site-builder/shared/site-data";
import type { PanelTheme } from "@/features/site-builder/crm/site-shell-theme";
import type { CurrentEntity, EditorSection } from "@/features/site-builder/crm/site-client-core";

export type BlockCode =
  | "ME001"
  | "ME002"
  | "ME003"
  | "HE001"
  | "HE002"
  | "HE003"
  | "LO001"
  | "LO002"
  | "LO003"
  | "LC001"
  | "SE001"
  | "SP001"
  | "BO001"
  | "BO002"
  | "AI001"
  | "HD001"
  | "TX001"
  | "IM001"
  | "FO001"
  | "BT001"
  | "AD001"
  | "AB001"
  | "FT001"
  | "TM001"
  | "NW001"
  | "WG001"
  | "WO001"
  | "WO002"
  | "RV001"
  | "CT001"
  | "PM001"
  | "CLL001"
  | "CLC001"
  | "LP001"
  | "SVP001"
  | "SPP001"
  | "GEN001";

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
  serviceCategories: ServiceCategoryItem[];
  specialistLevels: SpecialistLevelItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  legalDocuments: LegalDocumentItem[];
  platformLegalDocuments: LegalDocumentItem[];
  bookingSettings: BookingSettings;
  editableLegalDocuments: EditableLegalDocumentItem[];

  activeTheme: SiteTheme;
  panelTheme: PanelTheme;
  currentEntity: CurrentEntity;

  currentPanelSections: EditorSection[];
  activePanelSectionId: string | null;
  setActivePanelSectionId: Dispatch<SetStateAction<string | null>>;

  coverDrawerKey: "slider" | "colors" | "typography" | "button" | "animation" | null;
  setCoverDrawerKey: Dispatch<SetStateAction<"slider" | "colors" | "typography" | "button" | "animation" | null>>;

  getCoverWidthButtonRef: () => RefObject<HTMLButtonElement | null>;
  getCoverWidthPopoverRef: () => RefObject<HTMLDivElement | null>;
  coverWidthModalOpen: boolean;
  setCoverWidthModalOpen: Dispatch<SetStateAction<boolean>>;

  updateBlock: UpdateBlock;
  updateLocationItem?: (location: LocationItem) => void;
  updateServiceItem?: (service: ServiceItem) => void;
  updateSpecialistItem?: (specialist: SpecialistItem) => void;
  updateBookingSettings?: (settings: BookingSettings) => void;
  updateEditableLegalDocuments?: (documents: EditableLegalDocumentItem[]) => void;
};
