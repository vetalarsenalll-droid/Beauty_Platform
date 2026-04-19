import { BusinessType, LegalType } from "@prisma/client";

export type BusinessCatalogItem = {
  key: BusinessType;
  label: string;
};

export const BUSINESS_CATALOG: BusinessCatalogItem[] = [
  { key: "BEAUTY_SALON", label: "Салон красоты" },
  { key: "HAIR_SALON", label: "Парикмахерская" },
  { key: "BARBERSHOP", label: "Барбершоп" },
  { key: "NAIL_STUDIO", label: "Ногтевая студия" },
  { key: "BROW_STUDIO", label: "Брови" },
  { key: "LASH_STUDIO", label: "Ресницы" },
  { key: "MAKEUP_STUDIO", label: "Визаж" },
  { key: "COSMETOLOGY_ESTHETIC", label: "Косметология эстетическая" },
  { key: "COSMETOLOGY_MEDICAL", label: "Косметология медицинская" },
  { key: "MASSAGE", label: "Массажный кабинет" },
  { key: "SPA_CENTER", label: "SPA-центр" },
  { key: "TATTOO_STUDIO", label: "Тату-студия" },
  { key: "PIERCING_STUDIO", label: "Пирсинг-студия" },
  { key: "PMU_STUDIO", label: "Студия перманентного макияжа" },
  { key: "EPILATION_STUDIO", label: "Студия эпиляции" },
  { key: "BATH_WELLNESS", label: "Банный комплекс/термальный центр" },
  { key: "DENTISTRY", label: "Стоматология" },
  { key: "MEDICAL_CLINIC", label: "Многопрофильная клиника" },
  { key: "PRIVATE_MEDICAL_PRACTICE", label: "Частный медицинский кабинет" },
  { key: "LAB_DIAGNOSTICS", label: "Лабораторная диагностика/забор анализов" },
  { key: "ULTRASOUND_DIAGNOSTICS", label: "УЗИ и функциональная диагностика" },
  { key: "PSYCHOLOGIST", label: "Психолог" },
  { key: "PSYCHOTHERAPIST", label: "Психотерапевт" },
  { key: "SPEECH_THERAPIST", label: "Логопед/дефектолог" },
  { key: "NUTRITIONIST", label: "Диетолог/нутрициолог" },
  { key: "REHAB_LFK", label: "Реабилитация/ЛФК" },
  { key: "FITNESS_CLUB", label: "Фитнес-клуб" },
  { key: "GYM", label: "Тренажерный зал" },
  { key: "YOGA_STUDIO", label: "Йога-студия" },
  { key: "PILATES_STUDIO", label: "Пилатес-студия" },
  { key: "STRETCHING_STUDIO", label: "Студия растяжки" },
  { key: "DANCE_STUDIO", label: "Танцевальная студия" },
  { key: "MARTIAL_ARTS_STUDIO", label: "Студия единоборств" },
  { key: "SWIMMING_POOL", label: "Плавание/бассейн" },
  { key: "PERSONAL_TRAINER", label: "Персональный тренер" },
  { key: "EDUCATION_CENTER", label: "Образовательный центр" },
  { key: "LANGUAGE_SCHOOL", label: "Языковая школа" },
  { key: "TUTORING", label: "Репетитор/индивидуальные уроки" },
  { key: "CHILD_CENTER", label: "Детский развивающий центр" },
  { key: "EXAM_PREP_CENTER", label: "Подготовка к экзаменам" },
  { key: "CREATIVE_EDU_STUDIO", label: "Творческая студия" },
  { key: "LEGAL_CONSULTING", label: "Юридическая консультация" },
  { key: "ACCOUNTING_CONSULTING", label: "Бухгалтерская консультация" },
  { key: "FINANCE_CONSULTING", label: "Финансовая консультация" },
  { key: "BUSINESS_CONSULTING", label: "Бизнес-консалтинг" },
  { key: "COACHING_MENTORING", label: "Коуч/ментор" },
  { key: "VET_CLINIC", label: "Ветеринарная клиника" },
  { key: "PET_GROOMING", label: "Груминг-салон" },
  { key: "DOG_TRAINING", label: "Кинолог/дрессировка" },
  { key: "PHOTO_STUDIO_RENT", label: "Фото-студия" },
  { key: "REHEARSAL_STUDIO_RENT", label: "Репетиционная студия" },
  { key: "COWORKING_SLOTS", label: "Коворкинг" },
  { key: "SPORTS_COURT_BOOKING", label: "Спортивные площадки" },
  { key: "PODCAST_STUDIO", label: "Студия подкастов" },
  { key: "COMPUTER_CLUB", label: "Компьютерный клуб" },
];

export const LEGAL_TYPE_OPTIONS: Array<{ key: LegalType; label: string }> = [
  { key: "PRIVATE_SPECIALIST", label: "Частный специалист" },
  { key: "SELF_EMPLOYED", label: "Самозанятый" },
  { key: "IP", label: "ИП" },
  { key: "OOO", label: "ООО" },
];

const BUSINESS_TYPE_SET = new Set<string>(BUSINESS_CATALOG.map((item) => item.key));
const LEGAL_TYPE_SET = new Set<string>(LEGAL_TYPE_OPTIONS.map((item) => item.key));

export function isBusinessType(value: string): value is BusinessType {
  return BUSINESS_TYPE_SET.has(value);
}

export function isLegalType(value: string): value is LegalType {
  return LEGAL_TYPE_SET.has(value);
}

