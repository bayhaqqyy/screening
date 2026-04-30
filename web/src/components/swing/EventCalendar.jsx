import React, { useState, useEffect } from 'react';
import { eventService } from '../../services/eventService';

const EventCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await eventService.getEvents();
        if (data && data.length > 0) {
          setEvents(data);
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="xl:col-span-1">
      <div className="bg-surface-container-low rounded-xl p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Event Calendar</h3>
          <span className="material-symbols-outlined text-primary">calendar_month</span>
        </div>
        
        {loading ? (
          <div className="flex-grow flex items-center justify-center">
            <span className="text-sm text-on-surface-variant">Loading events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex-grow flex items-center justify-center">
            <span className="text-sm text-on-surface-variant">No upcoming events.</span>
          </div>
        ) : (
        <div className="space-y-6 flex-grow custom-scrollbar overflow-y-auto pr-2">
          {events.map((event, i) => {
            const dateStr = new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            // Generate some deterministic colors based on event type
            let color = 'primary';
            if (event.event_type.toLowerCase().includes('dividend')) color = 'tertiary';
            if (event.event_type.toLowerCase().includes('report') || event.event_type.toLowerCase().includes('expose')) color = 'secondary';
            
            return (
              <div key={i} className={`relative pl-6 border-l-2 border-${color}/20`}>
                <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-${color} ring-4 ring-${color}/10`}></div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">{dateStr}</span>
                  <h4 className="text-sm font-bold text-blue-100">{event.ticker} - {event.event_type}</h4>
                  <p className="text-xs text-on-surface-variant">{event.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        )}
        
        <button className="mt-6 w-full py-2.5 text-xs font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-all">
          View Full Calendar
        </button>
      </div>
    </div>
  );
};

export default EventCalendar;
