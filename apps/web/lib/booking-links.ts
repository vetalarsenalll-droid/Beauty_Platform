type BookingLinkParams = {
  publicSlug: string;
  locationId?: number | null;
  serviceId?: number | null;
  specialistId?: number | null;
  scenario?: "dateFirst" | "serviceFirst" | "specialistFirst";
};

export function buildBookingLink({
  publicSlug,
  locationId,
  serviceId,
  specialistId,
  scenario,
}: BookingLinkParams) {
  const search = new URLSearchParams();
  if (locationId) search.set("locationId", String(locationId));
  if (serviceId) search.set("serviceId", String(serviceId));
  if (specialistId) search.set("specialistId", String(specialistId));
  if (scenario) search.set("scenario", scenario);
  const query = search.toString();
  return `/${publicSlug}/booking${query ? `?${query}` : ""}`;
}
