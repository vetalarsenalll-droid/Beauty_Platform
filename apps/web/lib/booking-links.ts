type BookingLinkParams = {
  publicSlug: string;
  locationId?: number | null;
  serviceId?: number | null;
  specialistId?: number | null;
  date?: string | null;
  time?: string | null;
  scenario?: "dateFirst" | "serviceFirst" | "specialistFirst";
  start?: "scenario";
};

export function buildBookingLink({
  publicSlug,
  locationId,
  serviceId,
  specialistId,
  date,
  time,
  scenario,
  start,
}: BookingLinkParams) {
  const search = new URLSearchParams();
  if (locationId) search.set("locationId", String(locationId));
  if (serviceId) search.set("serviceId", String(serviceId));
  if (specialistId) search.set("specialistId", String(specialistId));
  if (date) search.set("date", date);
  if (time) search.set("time", time);
  if (scenario) search.set("scenario", scenario);
  if (start) search.set("start", start);
  const query = search.toString();
  return `/${publicSlug}/booking${query ? `?${query}` : ""}`;
}
