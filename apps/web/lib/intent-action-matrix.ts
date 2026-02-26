import { AishaIntent } from "@/lib/dialog-policy";

export type MatrixRow = {
  route: "chat-only" | "booking-flow" | "client-actions";
  handler: string;
  required: string[];
  nextState: string;
  fallback: string;
};

export const INTENT_ACTION_MATRIX: Record<AishaIntent, MatrixRow> = {
  greeting: { route: "chat-only", handler: "chat.greeting", required: [], nextState: "IDLE", fallback: "chat.smalltalk" },
  smalltalk: { route: "chat-only", handler: "chat.smalltalk", required: [], nextState: "IDLE", fallback: "chat.smalltalk" },
  identity: { route: "chat-only", handler: "chat.identity", required: [], nextState: "IDLE", fallback: "chat.identity" },
  capabilities: { route: "chat-only", handler: "chat.capabilities", required: [], nextState: "IDLE", fallback: "chat.capabilities" },
  contact_phone: { route: "chat-only", handler: "chat.contactPhone", required: [], nextState: "IDLE", fallback: "chat.contactPhone" },
  contact_address: { route: "chat-only", handler: "chat.contactAddress", required: [], nextState: "IDLE", fallback: "chat.contactAddress" },
  working_hours: { route: "chat-only", handler: "chat.workingHours", required: [], nextState: "IDLE", fallback: "chat.workingHours" },
  ask_services: { route: "chat-only", handler: "chat.listServices", required: [], nextState: "IDLE", fallback: "chat.listServices" },
  ask_price: { route: "chat-only", handler: "chat.servicePrice", required: ["service"], nextState: "IDLE", fallback: "chat.listServices" },
  ask_specialists: { route: "chat-only", handler: "chat.specialists", required: [], nextState: "IDLE", fallback: "chat.specialists" },
  ask_availability: { route: "booking-flow", handler: "booking.availability", required: [], nextState: "COLLECTING", fallback: "booking.askMissing" },
  booking_start: { route: "booking-flow", handler: "booking.start", required: [], nextState: "COLLECTING", fallback: "booking.askMissing" },
  booking_set_location: { route: "booking-flow", handler: "booking.setLocation", required: ["location"], nextState: "COLLECTING", fallback: "booking.askLocation" },
  booking_set_service: { route: "booking-flow", handler: "booking.setService", required: ["service"], nextState: "COLLECTING", fallback: "booking.askService" },
  booking_set_date: { route: "booking-flow", handler: "booking.setDate", required: ["date"], nextState: "COLLECTING", fallback: "booking.askDate" },
  booking_set_time: { route: "booking-flow", handler: "booking.setTime", required: ["time"], nextState: "COLLECTING", fallback: "booking.askTime" },
  booking_set_specialist: {
    route: "booking-flow",
    handler: "booking.setSpecialist",
    required: ["specialist"],
    nextState: "COLLECTING",
    fallback: "booking.askSpecialist",
  },
  booking_mode_self: { route: "booking-flow", handler: "booking.modeSelf", required: [], nextState: "READY_SELF", fallback: "booking.askMode" },
  booking_mode_assistant: {
    route: "booking-flow",
    handler: "booking.modeAssistant",
    required: [],
    nextState: "WAITING_CONSENT",
    fallback: "booking.askMode",
  },
  consent: { route: "booking-flow", handler: "booking.consent", required: [], nextState: "WAITING_CONFIRMATION", fallback: "booking.askConsent" },
  confirm: { route: "booking-flow", handler: "booking.confirm", required: [], nextState: "CHECKING", fallback: "booking.askConfirm" },
  reject_or_change: { route: "booking-flow", handler: "booking.change", required: [], nextState: "COLLECTING", fallback: "booking.askWhatChange" },
  reschedule: { route: "booking-flow", handler: "booking.reschedule", required: [], nextState: "RESCHEDULE_FLOW", fallback: "booking.askReschedule" },
  cancel_booking: { route: "booking-flow", handler: "booking.cancel", required: [], nextState: "CANCEL_FLOW", fallback: "booking.askCancel" },
  status_check: { route: "booking-flow", handler: "booking.status", required: [], nextState: "IDLE", fallback: "booking.status" },
  post_completion_smalltalk: {
    route: "chat-only",
    handler: "chat.postCompletion",
    required: [],
    nextState: "COMPLETED",
    fallback: "chat.postCompletion",
  },
  new_booking_after_completed: {
    route: "booking-flow",
    handler: "booking.newAfterCompleted",
    required: [],
    nextState: "COLLECTING",
    fallback: "booking.start",
  },
  my_bookings: { route: "client-actions", handler: "client.myBookings", required: ["auth"], nextState: "IDLE", fallback: "client.authRequired" },
  my_stats: { route: "client-actions", handler: "client.myStats", required: ["auth"], nextState: "IDLE", fallback: "client.authRequired" },
  cancel_my_booking: {
    route: "client-actions",
    handler: "client.cancel",
    required: ["auth"],
    nextState: "CANCEL_FLOW",
    fallback: "client.authRequired",
  },
  reschedule_my_booking: {
    route: "client-actions",
    handler: "client.reschedule",
    required: ["auth"],
    nextState: "RESCHEDULE_FLOW",
    fallback: "client.authRequired",
  },
  repeat_booking: { route: "client-actions", handler: "client.repeat", required: ["auth"], nextState: "COLLECTING", fallback: "client.authRequired" },
  client_profile: { route: "client-actions", handler: "client.profile", required: ["auth"], nextState: "IDLE", fallback: "client.authRequired" },
  out_of_scope: { route: "chat-only", handler: "chat.outOfScope", required: [], nextState: "IDLE", fallback: "chat.outOfScope" },
  abuse_or_toxic: { route: "chat-only", handler: "chat.deescalate", required: [], nextState: "IDLE", fallback: "chat.deescalate" },
  unknown: { route: "chat-only", handler: "chat.unknown", required: [], nextState: "IDLE", fallback: "chat.unknown" },
};
