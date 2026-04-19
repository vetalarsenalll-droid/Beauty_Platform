import { BusinessType } from "@prisma/client";
import { SiteDraft } from "@/lib/site-builder";

type CoverBlockText = {
  title: string;
  subtitle?: string;
  description: string;
  buttonText: string;
};

type CoverSlide = {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonPage: string;
  buttonHref: string;
  imageUrl: string;
};

type BusinessDirectionCopy = {
  label: string;
  focus: string;
};

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

const FITNESS: BusinessType[] = [
  "FITNESS_CLUB",
  "GYM",
  "YOGA_STUDIO",
  "PILATES_STUDIO",
  "STRETCHING_STUDIO",
  "DANCE_STUDIO",
  "MARTIAL_ARTS_STUDIO",
  "SWIMMING_POOL",
  "PERSONAL_TRAINER",
];

const PET: BusinessType[] = ["PET_GROOMING", "DOG_TRAINING"];

const DIRECTION_COPY: Record<BusinessType, BusinessDirectionCopy> = {
  BEAUTY_SALON: {
    label: "Салон красоты",
    focus: "Стрижки, окрашивание, уходовые процедуры и услуги мастеров в удобное время.",
  },
  HAIR_SALON: {
    label: "Парикмахерская",
    focus: "Женские, мужские и детские стрижки, окрашивание и укладки по предварительной записи.",
  },
  BARBERSHOP: {
    label: "Барбершоп",
    focus: "Стрижки, оформление бороды и мужской уход по четкому расписанию мастеров.",
  },
  NAIL_STUDIO: {
    label: "Ногтевая студия",
    focus: "Маникюр, педикюр и дизайн ногтей с выбором мастера и времени визита.",
  },
  BROW_STUDIO: {
    label: "Брови",
    focus: "Архитектура, окрашивание и долговременная укладка бровей по слотам.",
  },
  LASH_STUDIO: {
    label: "Ресницы",
    focus: "Наращивание, ламинирование и уход за ресницами с онлайн-записью к специалисту.",
  },
  MAKEUP_STUDIO: {
    label: "Визаж",
    focus: "Макияж для мероприятий, фотосессий и свадеб с удобным выбором времени.",
  },
  COSMETOLOGY_ESTHETIC: {
    label: "Косметология эстетическая",
    focus: "Эстетические процедуры ухода за лицом и телом по расписанию косметологов.",
  },
  COSMETOLOGY_MEDICAL: {
    label: "Косметология медицинская",
    focus: "Медицинские косметологические услуги с записью к профильному специалисту.",
  },
  MASSAGE: {
    label: "Массажный кабинет",
    focus: "Лечебный, расслабляющий и спортивный массаж с выбором длительности сеанса.",
  },
  SPA_CENTER: {
    label: "SPA-центр",
    focus: "SPA-программы, уходовые ритуалы и релакс-процедуры по слотам времени.",
  },
  TATTOO_STUDIO: {
    label: "Тату-студия",
    focus: "Сеансы татуировки и консультации с мастером по прозрачному расписанию.",
  },
  PIERCING_STUDIO: {
    label: "Пирсинг-студия",
    focus: "Проколы, замена украшений и консультации с мастером по записи.",
  },
  PMU_STUDIO: {
    label: "Студия перманентного макияжа",
    focus: "Перманентный макияж и коррекция с выбором специалиста и времени.",
  },
  EPILATION_STUDIO: {
    label: "Студия эпиляции",
    focus: "Лазерная и восковая эпиляция по услугам, зонам и свободным слотам.",
  },
  BATH_WELLNESS: {
    label: "Банный комплекс/термальный центр",
    focus: "Банные программы, парения и wellness-услуги с предварительным бронированием.",
  },
  DENTISTRY: {
    label: "Стоматология",
    focus: "Прием стоматологов, диагностика и процедуры с подтверждением времени визита.",
  },
  MEDICAL_CLINIC: {
    label: "Многопрофильная клиника",
    focus: "Запись к врачам разных направлений и управление графиком приемов.",
  },
  PRIVATE_MEDICAL_PRACTICE: {
    label: "Частный медицинский кабинет",
    focus: "Индивидуальные приемы, консультации и процедуры в точных временных слотах.",
  },
  LAB_DIAGNOSTICS: {
    label: "Лабораторная диагностика/забор анализов",
    focus: "Запись на анализы и диагностические услуги без очередей и звонков.",
  },
  ULTRASOUND_DIAGNOSTICS: {
    label: "УЗИ и функциональная диагностика",
    focus: "Исследования и диагностика по направлению с выбором удобного времени.",
  },
  PSYCHOLOGIST: {
    label: "Психолог",
    focus: "Индивидуальные консультации с гибким расписанием онлайн-записи.",
  },
  PSYCHOTHERAPIST: {
    label: "Психотерапевт",
    focus: "Психотерапевтические сессии по расписанию специалиста и формату встречи.",
  },
  SPEECH_THERAPIST: {
    label: "Логопед/дефектолог",
    focus: "Коррекционные занятия и консультации для детей и взрослых по слотам.",
  },
  NUTRITIONIST: {
    label: "Диетолог/нутрициолог",
    focus: "Разбор питания, консультации и сопровождение с удобной записью.",
  },
  REHAB_LFK: {
    label: "Реабилитация/ЛФК",
    focus: "Реабилитационные программы, ЛФК и индивидуальные занятия по графику.",
  },
  FITNESS_CLUB: {
    label: "Фитнес-клуб",
    focus: "Тренировки, персональные сессии и групповые занятия по расписанию клуба.",
  },
  GYM: {
    label: "Тренажерный зал",
    focus: "Тренировки с тренером, вводные сессии и программы занятий по слотам.",
  },
  YOGA_STUDIO: {
    label: "Йога-студия",
    focus: "Групповые и персональные практики йоги с онлайн-бронированием мест.",
  },
  PILATES_STUDIO: {
    label: "Пилатес-студия",
    focus: "Индивидуальные и групповые занятия пилатесом с выбором удобного времени.",
  },
  STRETCHING_STUDIO: {
    label: "Студия растяжки",
    focus: "Занятия по растяжке и mobility-форматы с записью на свободные места.",
  },
  DANCE_STUDIO: {
    label: "Танцевальная студия",
    focus: "Танцевальные классы для разных уровней и запись на групповые слоты.",
  },
  MARTIAL_ARTS_STUDIO: {
    label: "Студия единоборств",
    focus: "Тренировки, спарринги и персональные занятия по расписанию зала.",
  },
  SWIMMING_POOL: {
    label: "Плавание/бассейн",
    focus: "Секции, персональные тренировки и дорожки по бронированию времени.",
  },
  PERSONAL_TRAINER: {
    label: "Персональный тренер",
    focus: "Персональные тренировки и сопровождение с гибким расписанием сессий.",
  },
  EDUCATION_CENTER: {
    label: "Образовательный центр",
    focus: "Курсы, занятия и консультации преподавателей с записью по слотам.",
  },
  LANGUAGE_SCHOOL: {
    label: "Языковая школа",
    focus: "Индивидуальные и групповые уроки по языкам с удобным расписанием.",
  },
  TUTORING: {
    label: "Репетитор/индивидуальные уроки",
    focus: "Индивидуальные уроки и подготовка по предметам с онлайн-записью.",
  },
  CHILD_CENTER: {
    label: "Детский развивающий центр",
    focus: "Развивающие занятия, кружки и консультации специалистов по времени.",
  },
  EXAM_PREP_CENTER: {
    label: "Подготовка к экзаменам",
    focus: "Подготовка к экзаменам, пробные занятия и консультации преподавателей.",
  },
  CREATIVE_EDU_STUDIO: {
    label: "Творческая студия",
    focus: "Занятия по рисованию, музыке и вокалу с записью в индивидуальные и групповые слоты.",
  },
  LEGAL_CONSULTING: {
    label: "Юридическая консультация",
    focus: "Первичные и повторные юридические консультации по расписанию специалиста.",
  },
  ACCOUNTING_CONSULTING: {
    label: "Бухгалтерская консультация",
    focus: "Бухгалтерские консультации, сопровождение и разбор вопросов по слотам.",
  },
  FINANCE_CONSULTING: {
    label: "Финансовая консультация",
    focus: "Финансовые консультации и планирование с выбором удобного времени встречи.",
  },
  BUSINESS_CONSULTING: {
    label: "Бизнес-консалтинг",
    focus: "Стратегические сессии и консультации по развитию бизнеса по записи.",
  },
  COACHING_MENTORING: {
    label: "Коуч/ментор",
    focus: "Коуч-сессии и менторские встречи с прозрачным календарем доступности.",
  },
  VET_CLINIC: {
    label: "Ветеринарная клиника",
    focus: "Приемы, осмотры и процедуры для питомцев с записью к ветеринару.",
  },
  PET_GROOMING: {
    label: "Груминг-салон",
    focus: "Груминг, стрижка и уход для питомцев с выбором мастера и времени.",
  },
  DOG_TRAINING: {
    label: "Кинолог/дрессировка",
    focus: "Индивидуальная и групповая дрессировка собак с записью по слотам.",
  },
  PHOTO_STUDIO_RENT: {
    label: "Фото-студия",
    focus: "Бронирование залов и оборудования по временным слотам.",
  },
  REHEARSAL_STUDIO_RENT: {
    label: "Репетиционная студия",
    focus: "Бронирование репетиционных комнат и оборудования по расписанию.",
  },
  COWORKING_SLOTS: {
    label: "Коворкинг",
    focus: "Бронирование рабочих мест, переговорных и кабинетов по слотам.",
  },
  SPORTS_COURT_BOOKING: {
    label: "Спортивные площадки",
    focus: "Бронирование кортов, полей и площадок на удобное время.",
  },
  PODCAST_STUDIO: {
    label: "Студия подкастов",
    focus: "Бронирование студии записи, оборудования и технических слотов.",
  },
  COMPUTER_CLUB: {
    label: "Компьютерный клуб",
    focus: "Бронирование игровых мест, VIP-зон и командных слотов.",
  },
};

function getDefaultCta(businessType: BusinessType) {
  if (RENTAL.includes(businessType)) return "Забронировать слот";
  if (CONSULTING.includes(businessType)) return "Записаться на консультацию";
  if (EDUCATION.includes(businessType)) return "Записаться на занятие";
  if (FITNESS.includes(businessType)) return "Записаться на тренировку";
  if (MEDICAL.includes(businessType)) return "Записаться на прием";
  if (PET.includes(businessType)) return "Записаться онлайн";
  return "Записаться онлайн";
}

function getSubtitleHe001(businessType: BusinessType) {
  if (RENTAL.includes(businessType)) {
    return "Онлайн-бронирование по слотам времени";
  }
  if (CONSULTING.includes(businessType)) {
    return "Удобная онлайн-запись на консультации";
  }
  if (EDUCATION.includes(businessType)) {
    return "Запись на уроки, курсы и групповые занятия";
  }
  if (FITNESS.includes(businessType)) {
    return "Запись на тренировки и групповые форматы";
  }
  if (MEDICAL.includes(businessType)) {
    return "Запись к специалисту в удобное время";
  }
  return "Онлайн-запись по услугам, специалистам и свободным слотам";
}

function getSubtitleHe003(businessType: BusinessType) {
  if (RENTAL.includes(businessType)) {
    return "Выберите свободный слот и отправьте бронь онлайн";
  }
  if (CONSULTING.includes(businessType)) {
    return "Выберите формат консультации и удобное время";
  }
  if (EDUCATION.includes(businessType)) {
    return "Выберите занятие, преподавателя и время";
  }
  if (FITNESS.includes(businessType)) {
    return "Выберите формат тренировки и свободный слот";
  }
  if (MEDICAL.includes(businessType)) {
    return "Выберите услугу и время приема без звонков";
  }
  return "Выберите услугу, мастера и удобное время визита";
}

function getCopyForBusinessType(
  businessType: BusinessType
): { he001: CoverBlockText; he002: CoverBlockText; he003: CoverBlockText } {
  const direction = DIRECTION_COPY[businessType];
  const cta = getDefaultCta(businessType);

  return {
    he001: {
      title: `${direction.label} — онлайн-запись`,
      subtitle: getSubtitleHe001(businessType),
      description: direction.focus,
      buttonText: cta,
    },
    he002: {
      title: `${direction.label}: расписание и слоты`,
      description: `${direction.focus} Выберите подходящее время и отправьте запись онлайн.`,
      buttonText: cta,
    },
    he003: {
      title: `${direction.label} — выберите время онлайн`,
      subtitle: getSubtitleHe003(businessType),
      description: `${direction.focus} Быстрое подтверждение записи и удобное управление расписанием.`,
      buttonText: cta,
    },
  };
}

function patchCoverBlock(block: SiteDraft["blocks"][number], businessType: BusinessType) {
  if (block.type !== "cover") return;
  const copy = getCopyForBusinessType(businessType);
  const direction = DIRECTION_COPY[businessType];
  const data = (block.data ?? {}) as Record<string, unknown>;

  if (block.variant === "v2") {
    data.title = copy.he002.title;
    data.description = copy.he002.description;
    data.buttonText = copy.he002.buttonText;
    data.subtitle = "";
    const slides: CoverSlide[] = [
      {
        id: "slide-1",
        title: `${direction.label} — онлайн-запись`,
        description: direction.focus,
        buttonText: copy.he002.buttonText,
        buttonPage: "booking",
        buttonHref: "",
        imageUrl: "",
      },
      {
        id: "slide-2",
        title: "Услуги и расписание",
        description: `Покажите актуальные услуги, специалистов и свободные слоты для направления «${direction.label}».`,
        buttonText: copy.he002.buttonText,
        buttonPage: "booking",
        buttonHref: "",
        imageUrl: "",
      },
      {
        id: "slide-3",
        title: "Запись без звонков",
        description: "Клиенты выбирают удобное время онлайн, а заявки сразу попадают в вашу CRM.",
        buttonText: copy.he002.buttonText,
        buttonPage: "booking",
        buttonHref: "",
        imageUrl: "",
      },
    ];
    data.coverSlides = slides;
  } else if (block.variant === "v3") {
    data.title = copy.he003.title;
    data.subtitle = copy.he003.subtitle ?? "";
    data.description = copy.he003.description;
    data.buttonText = copy.he003.buttonText;
  } else {
    data.title = copy.he001.title;
    data.subtitle = copy.he001.subtitle ?? "";
    data.description = copy.he001.description;
    data.buttonText = copy.he001.buttonText;
  }

  block.data = data;
}

export function applyBusinessTypeSiteCopy(draft: SiteDraft, businessType: BusinessType): SiteDraft {
  if (Array.isArray(draft.blocks)) {
    for (const block of draft.blocks) {
      patchCoverBlock(block, businessType);
    }
  }

  if (Array.isArray(draft.pages?.home)) {
    for (const block of draft.pages.home) {
      patchCoverBlock(block, businessType);
    }
  }

  return draft;
}
