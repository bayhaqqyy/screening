import React from 'react';

const mockHistory = [
  {
    icon: 'notifications_active', iconBg: 'bg-error/10 text-error',
    title: 'JPM Triggered', desc: 'Price crossed ', price: '195.00', priceColor: 'text-error',
    time: 'Today, 09:42:15 AM'
  },
  {
    icon: 'check_circle', iconBg: 'bg-secondary/10 text-secondary',
    title: 'BAC Alert Set', desc: 'Resistance check at ', price: '42.50', priceColor: 'text-secondary',
    time: 'Today, 08:30:01 AM'
  },
  {
    icon: 'info', iconBg: 'bg-tertiary/10 text-tertiary',
    title: 'Watchlist Update', desc: 'Added ', tag: 'XOM', descEnd: ' to Energy', tagColor: 'text-tertiary',
    time: 'Yesterday, 04:15 PM'
  }
];

const AlertHistory = () => {
  return (
    <div className="col-span-12 bg-surface-container-low rounded-2xl p-8 space-y-6 mt-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary">history</span>
          </div>
          <h3 className="font-bold text-blue-100 text-lg">Alert History Log</h3>
        </div>
        <button className="text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors flex items-center space-x-1 uppercase tracking-widest">
          <span>Clear Log</span>
          <span className="material-symbols-outlined text-sm">delete_sweep</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockHistory.map((item, idx) => (
          <div key={idx} className="flex items-start space-x-4 p-4 rounded-xl bg-surface-container-highest/40 hover:bg-surface-container-highest transition-colors">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center`}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-blue-100 uppercase tracking-tighter">{item.title}</p>
              <p className="text-sm text-on-surface">
                {item.desc}
                {item.price && <span className={`${item.priceColor} tabular-nums`}>{item.price}</span>}
                {item.tag && <span className={`${item.tagColor} font-bold`}>{item.tag}</span>}
                {item.descEnd}
              </p>
              <p className="text-[10px] text-on-surface-variant tabular-nums flex items-center">
                <span className="material-symbols-outlined text-[12px] mr-1">schedule</span>
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertHistory;
