export type AishaIntent =
  | "greeting"
  | "smalltalk"
  | "identity"
  | "capabilities"
  | "contact_phone"
  | "contact_address"
  | "working_hours"
  | "ask_services"
  | "ask_price"
  | "ask_specialists"
  | "ask_availability"
  | "booking_start"
  | "booking_set_location"
  | "booking_set_service"
  | "booking_set_date"
  | "booking_set_time"
  | "booking_set_specialist"
  | "booking_mode_self"
  | "booking_mode_assistant"
  | "consent"
  | "confirm"
  | "reject_or_change"
  | "reschedule"
  | "cancel_booking"
  | "status_check"
  | "post_completion_smalltalk"
  | "new_booking_after_completed"
  | "my_bookings"
  | "my_stats"
  | "cancel_my_booking"
  | "reschedule_my_booking"
  | "repeat_booking"
  | "client_profile"
  | "out_of_scope"
  | "abuse_or_toxic"
  | "unknown";

export type PolicyRoute = "chat-only" | "booking-flow" | "client-actions";

export const INTENT_PRIORITY: AishaIntent[] = [
  "abuse_or_toxic",
  "cancel_my_booking",
  "reschedule_my_booking",
  "my_bookings",
  "my_stats",
  "repeat_booking",
  "client_profile",
  "contact_phone",
  "working_hours",
  "contact_address",
  "ask_price",
  "ask_services",
  "ask_specialists",
  "ask_availability",
  "booking_start",
  "booking_set_location",
  "booking_set_service",
  "booking_set_date",
  "booking_set_time",
  "booking_set_specialist",
  "booking_mode_self",
  "booking_mode_assistant",
  "consent",
  "confirm",
  "reject_or_change",
  "reschedule",
  "cancel_booking",
  "status_check",
  "new_booking_after_completed",
  "post_completion_smalltalk",
  "greeting",
  "smalltalk",
  "identity",
  "capabilities",
  "out_of_scope",
  "unknown",
];

export function routeForIntent(intent: AishaIntent): PolicyRoute {
  if (
    intent === "my_bookings" ||
    intent === "my_stats" ||
    intent === "cancel_my_booking" ||
    intent === "reschedule_my_booking" ||
    intent === "repeat_booking" ||
    intent === "client_profile"
  ) {
    return "client-actions";
  }
  if (
    intent.startsWith("booking_") ||
    intent === "ask_availability" ||
    intent === "consent" ||
    intent === "confirm" ||
    intent === "reject_or_change" ||
    intent === "reschedule" ||
    intent === "cancel_booking" ||
    intent === "status_check" ||
    intent === "new_booking_after_completed"
  ) {
    return "booking-flow";
  }
  return "chat-only";
}

export const ANTI_HALLUCINATION_RULES = [
  "Все факты о слотах, услугах, ценах, мастерах и графике берутся только из БД/API.",
  "Если данных нет — честно сообщать об отсутствии данных, не выдумывать.",
  "Критичные операции (create/cancel/reschedule/update profile) только после подтверждения клиента.",
];

export function isConversationalIntent(intent: AishaIntent) {
  return intent === "greeting" || intent === "smalltalk" || intent === "identity" || intent === "capabilities";
}
