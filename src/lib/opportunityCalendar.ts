import type { OpportunityView } from '@/hooks/useOpportunities';

const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

type OpportunityCalendarSource = Pick<
  OpportunityView,
  'title' | 'description' | 'isRemote' | 'location' | 'deadline' | 'startDate'
>;

const isValidDate = (value: Date | null | undefined): value is Date =>
  Boolean(value && !Number.isNaN(value.getTime()));

export const parseOpportunityDate = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

export const createOpportunityDateTimeIso = (date: string, time: string) => {
  if (!date || !time) return undefined;

  const parsed = new Date(`${date}T${time}`);
  return isValidDate(parsed) ? parsed.toISOString() : undefined;
};

export const getTimeInputValue = (value?: string | null) => {
  const parsed = parseOpportunityDate(value);
  if (!parsed) return '';

  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const getOpportunityCalendarRange = (
  opportunity: Pick<OpportunityView, 'deadline' | 'startDate'>,
) => {
  const start = parseOpportunityDate(opportunity.startDate);
  const end = parseOpportunityDate(opportunity.deadline);

  if (start && end && end.getTime() > start.getTime()) {
    return { start, end };
  }

  if (start) {
    return {
      start,
      end: new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS),
    };
  }

  if (end) {
    return {
      start: end,
      end: new Date(end.getTime() + DEFAULT_EVENT_DURATION_MS),
    };
  }

  return null;
};

const toGoogleCalendarDate = (date: Date) =>
  `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

export const buildOpportunityCalendarUrl = (
  opportunity: OpportunityCalendarSource,
) => {
  const range = getOpportunityCalendarRange(opportunity);
  if (!range) return null;

  const title = encodeURIComponent(opportunity.title);
  const details = encodeURIComponent(opportunity.description);
  const location = encodeURIComponent(
    opportunity.isRemote ? 'Remote' : opportunity.location || '',
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${toGoogleCalendarDate(range.start)}/${toGoogleCalendarDate(range.end)}`;
};