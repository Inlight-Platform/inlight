export const isEventPast = (eventDate?: string | null, now: Date = new Date()) => {
  if (!eventDate) return false;

  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < now.getTime();
};
