import { BusinessType } from "@prisma/client";
import { SiteDraft } from "@/lib/site-builder";
import { BUSINESS_CATALOG } from "@/lib/business-catalog";

type BusinessCopyPreset = {
  subtitle: string;
  description: string;
  cta: string;
};

const SPORT_AND_GROUP: BusinessType[] = [
  "FITNESS_CLUB",
  "GYM",
  "YOGA_STUDIO",
  "PILATES_STUDIO",
  "STRETCHING_STUDIO",
  "DANCE_STUDIO",
  "MARTIAL_ARTS_STUDIO",
  "SWIMMING_POOL",
];

const MEDICAL: BusinessType[] = [
  "DENTISTRY",
  "MEDICAL_CLINIC",
  "PRIVATE_MEDICAL_PRACTICE",
  "LAB_DIAGNOSTICS",
  "ULTRASOUND_DIAGNOSTICS",
  "PSYCHOLOGIST",
  "PSYCHOTHERAPIST",
  "SPEECH_THERAPIST",
  "NUTRITIONIST",
  "REHAB_LFK",
  "VET_CLINIC",
];

const EDUCATION: BusinessType[] = [
  "EDUCATION_CENTER",
  "LANGUAGE_SCHOOL",
  "TUTORING",
  "CHILD_CENTER",
  "EXAM_PREP_CENTER",
  "CREATIVE_EDU_STUDIO",
];

const CONSULTING: BusinessType[] = [
  "LEGAL_CONSULTING",
  "ACCOUNTING_CONSULTING",
  "FINANCE_CONSULTING",
  "BUSINESS_CONSULTING",
  "COACHING_MENTORING",
];

const RENTAL: BusinessType[] = [
  "PHOTO_STUDIO_RENT",
  "REHEARSAL_STUDIO_RENT",
  "COWORKING_SLOTS",
  "SPORTS_COURT_BOOKING",
  "PODCAST_STUDIO",
  "COMPUTER_CLUB",
];

function getLabel(businessType: BusinessType) {
  return BUSINESS_CATALOG.find((item) => item.key === businessType)?.label ?? "Бизнес";
}

function getPreset(businessType: BusinessType): BusinessCopyPreset {
  if (SPORT_AND_GROUP.includes(businessType)) {
    return {
      subtitle: "Онлайн-запись на тренировки и групповые занятия",
      description:
        "Выберите формат занятия, тренера и удобный слот времени. Управляйте расписанием и записями в одном месте.",
      cta: "Выбрать занятие",
    };
  }

  if (MEDICAL.includes(businessType)) {
    return {
      subtitle: "Онлайн-запись на прием к специалисту",
      description:
        "Выберите услугу, врача и удобное время визита. Подтверждение записи и напоминания работают автоматически.",
      cta: "Записаться на прием",
    };
  }

  if (EDUCATION.includes(businessType)) {
    return {
      subtitle: "Онлайн-запись на уроки и занятия",
      description:
        "Выберите направление, преподавателя и удобный слот. Подходит для индивидуальных и групповых занятий.",
      cta: "Записаться на занятие",
    };
  }

  if (CONSULTING.includes(businessType)) {
    return {
      subtitle: "Онлайн-запись на консультации",
      description:
        "Клиенты выбирают услугу и удобное время консультации, а вы управляете загрузкой и подтверждениями в CRM.",
      cta: "Записаться на консультацию",
    };
  }

  if (RENTAL.includes(businessType)) {
    return {
      subtitle: "Онлайн-бронирование по слотам времени",
      description:
        "Покажите свободные интервалы и принимайте бронирования без переписок. Все слоты и статусы в одном календаре.",
      cta: "Забронировать слот",
    };
  }

  return {
    subtitle: "Онлайн-запись и удобное управление расписанием",
    description:
      "Выберите услугу, специалиста и время визита. ONLAIS помогает принимать записи и управлять загрузкой бизнеса.",
    cta: "Записаться",
  };
}

export function applyBusinessTypeSiteCopy(draft: SiteDraft, businessType: BusinessType): SiteDraft {
  const preset = getPreset(businessType);
  const label = getLabel(businessType);

  const patchCover = (blocks: SiteDraft["blocks"] | undefined) => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
      if (block.type !== "cover") continue;
      const data = ((block.data ?? {}) as Record<string, unknown>);
      data.subtitle = preset.subtitle;
      data.description = `${preset.description} Направление: ${label}.`;
      data.buttonText = preset.cta;
      block.data = data;
      break;
    }
  };

  patchCover(draft.blocks);
  patchCover(draft.pages?.home);

  return draft;
}

