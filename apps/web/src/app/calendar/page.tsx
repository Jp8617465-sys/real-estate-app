'use client';

import { useState, useMemo } from 'react';
import {
  useCalendarEvents,
  useCalendarConnections,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
} from '@/hooks/use-calendar';

const EVENT_TYPE_COLORS: Record<string, string> = {
  inspection: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  open_home: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  client_meeting: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  auction: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  settlement: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  phone_call: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  inspection: 'Inspection',
  open_home: 'Open Home',
  client_meeting: 'Client Meeting',
  auction: 'Auction',
  settlement: 'Settlement',
  phone_call: 'Phone Call',
  other: 'Other',
};

export default function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date());
  const [filterType, setFilterType] = useState<string | undefined>();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const startOfWeek = useMemo(() => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    d.setHours(0, 0, 0, 0);
    return d;
  }, [viewDate]);

  const endOfWeek = useMemo(() => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + 7);
    return d;
  }, [startOfWeek]);

  const { data: events, isLoading } = useCalendarEvents({
    startDate: startOfWeek.toISOString(),
    endDate: endOfWeek.toISOString(),
    eventType: filterType,
  });
  const { data: connections } = useCalendarConnections();
  const createEvent = useCreateCalendarEvent();
  const _deleteEvent = useDeleteCalendarEvent();

  const [newEvent, setNewEvent] = useState({
    title: '',
    eventType: 'inspection',
    startTime: '',
    endTime: '',
    location: '',
  });

  const handleCreate = () => {
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime) return;
    createEvent.mutate(
      { ...newEvent, syncToCalendar: true },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setNewEvent({ title: '', eventType: 'inspection', startTime: '', endTime: '', location: '' });
        },
      },
    );
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const eventList = (events as Array<Record<string, unknown>>) ?? [];

  const eventsByDay = useMemo(() => {
    const map: Record<string, Array<Record<string, unknown>>> = {};
    for (const day of days) {
      const key = day.toISOString().split('T')[0]!;
      map[key] = eventList.filter(e => {
        const eventDate = new Date(e.start_time as string).toISOString().split('T')[0];
        return eventDate === key;
      });
    }
    return map;
  }, [eventList, days]);

  const prevWeek = () => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday = () => setViewDate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Inspections, meetings, and appointments
            {(connections as unknown[] ?? []).length > 0 && (
              <span className="ml-2 text-green-600">
                · {(connections as unknown[]).length} calendar{(connections as unknown[]).length > 1 ? 's' : ''} synced
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New Event
        </button>
      </div>

      {/* Create Event Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create Event</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                value={newEvent.title}
                onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                placeholder="e.g., Inspection at 42 Smith St"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <select
                value={newEvent.eventType}
                onChange={e => setNewEvent(p => ({ ...p, eventType: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start</label>
              <input
                type="datetime-local"
                value={newEvent.startTime}
                onChange={e => setNewEvent(p => ({ ...p, startTime: new Date(e.target.value).toISOString() }))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End</label>
              <input
                type="datetime-local"
                value={newEvent.endTime}
                onChange={e => setNewEvent(p => ({ ...p, endTime: new Date(e.target.value).toISOString() }))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
              <input
                value={newEvent.location}
                onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                placeholder="Property address or meeting location"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createEvent.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {createEvent.isPending ? 'Creating...' : 'Create Event'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">&larr;</button>
          <button onClick={goToday} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">Today</button>
          <button onClick={nextWeek} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">&rarr;</button>
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {startOfWeek.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <select
          value={filterType ?? ''}
          onChange={e => setFilterType(e.target.value || undefined)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">All Types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Week View */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const key = day.toISOString().split('T')[0]!;
            const dayEvents = eventsByDay[key] ?? [];
            const isToday = key === new Date().toISOString().split('T')[0];

            return (
              <div
                key={key}
                className={`min-h-[12rem] rounded-lg border p-2 ${isToday ? 'border-brand-300 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
              >
                <div className="mb-2 text-xs font-medium text-gray-500">
                  <span className={isToday ? 'text-brand-600 font-bold' : ''}>
                    {day.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div
                      key={event.id as string}
                      className={`rounded-md px-2 py-1 text-xs ${EVENT_TYPE_COLORS[event.event_type as string] ?? EVENT_TYPE_COLORS.other}`}
                    >
                      <div className="font-medium truncate">{event.title as string}</div>
                      <div className="text-xs opacity-75">
                        {new Date(event.start_time as string).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
