import React from 'react';

const mockEvents = [
  { date: '24 Oct 2024', title: 'BBRI - RUPS Tahunan', desc: 'Annual General Meeting & Dividend Policy discussion.', color: 'primary' },
  { date: '27 Oct 2024', title: 'UNTR - Dividend Cum Date', desc: 'Interim dividend payout of IDR 700 per share.', color: 'tertiary' },
  { date: '02 Nov 2024', title: 'ASII - Public Expose', desc: 'Q3 Performance report and future automotive outlook.', color: 'secondary' },
  { date: '10 Nov 2024', title: 'MDKA - Private Placement', desc: 'Listing of new shares for expansion funding.', color: 'primary' }
];

const EventCalendar = () => {
  return (
    <div className="xl:col-span-1">
      <div className="bg-surface-container-low rounded-xl p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Event Calendar</h3>
          <span className="material-symbols-outlined text-primary">calendar_month</span>
        </div>
        
        <div className="space-y-6 flex-grow custom-scrollbar overflow-y-auto pr-2">
          {mockEvents.map((event, i) => (
            <div key={i} className={`relative pl-6 border-l-2 border-${event.color}/20`}>
              <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-${event.color} ring-4 ring-${event.color}/10`}></div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">{event.date}</span>
                <h4 className="text-sm font-bold text-blue-100">{event.title}</h4>
                <p className="text-xs text-on-surface-variant">{event.desc}</p>
              </div>
            </div>
          ))}
        </div>
        
        <button className="mt-6 w-full py-2.5 text-xs font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-all">
          View Full Calendar
        </button>
      </div>
    </div>
  );
};

export default EventCalendar;
