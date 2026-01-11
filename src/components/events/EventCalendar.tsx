import React from 'react';
import { Event } from '@/store/useStore';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface EventCalendarProps {
  events: Event[];
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
}

const EventCalendar: React.FC<EventCalendarProps> = ({
  events,
  selectedDate,
  onSelectDate,
}) => {
  // Get dates that have events
  const eventDates = events.map((e) => {
    const date = new Date(e.date);
    return date.toDateString();
  });

  const hasEvent = (date: Date) => {
    return eventDates.includes(date.toDateString());
  };

  const getEventCount = (date: Date) => {
    return eventDates.filter((d) => d === date.toDateString()).length;
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <h3 className="font-semibold mb-4">Calendar</h3>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelectDate}
        className="rounded-md"
        modifiers={{
          hasEvent: (date) => hasEvent(date),
        }}
        modifiersStyles={{
          hasEvent: {
            fontWeight: 'bold',
          },
        }}
        components={{
          DayContent: ({ date }) => {
            const count = getEventCount(date);
            return (
              <div className="relative w-full h-full flex items-center justify-center">
                <span>{date.getDate()}</span>
                {count > 0 && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </div>
            );
          },
        }}
      />
    </div>
  );
};

export default EventCalendar;
