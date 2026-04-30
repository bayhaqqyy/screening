import React, { useState, useEffect } from 'react';

const MarketStatus = () => {
  const [status, setStatus] = useState({
    label: "Calculating...",
    countdown: "--:--",
    progress: 0,
    msg: "Please wait"
  });

  useEffect(() => {
    const updateTime = () => {
      // Get current time in WIB (UTC+7)
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const wib = new Date(utc + (3600000 * 7));
      
      const day = wib.getDay();
      const h = wib.getHours();
      const m = wib.getMinutes();
      const s = wib.getSeconds();
      
      const currentMin = h * 60 + m;
      
      // IDX Hours
      // Session 1: 09:00 (540) - 11:30 (690) -> 150 mins
      // Session 2: 13:30 (810) - 16:00 (960) -> 150 mins
      
      if (day === 0 || day === 6) {
        setStatus({ label: "Market Closed", countdown: "Weekend", progress: 0, msg: "Enjoy your weekend!" });
        return;
      }
      
      if (currentMin < 540) {
        // Pre-open
        const diff = 540 - currentMin - 1;
        const secs = 59 - s;
        setStatus({ label: "Pre-Opening", countdown: `Opens in ${Math.floor(diff/60)}h ${diff%60}m`, progress: 0, msg: "Market preparing to open" });
      } else if (currentMin >= 540 && currentMin < 690) {
        // Sesi 1
        const diff = 690 - currentMin - 1;
        const secs = 59 - s;
        const passed = currentMin - 540;
        const progress = (passed / 150) * 100;
        setStatus({ label: "Sesi 1 — Active", countdown: `${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}:${String(secs).padStart(2,'0')}`, progress, msg: "Morning session in progress" });
      } else if (currentMin >= 690 && currentMin < 810) {
        // Break
        const diff = 810 - currentMin - 1;
        setStatus({ label: "Lunch Break", countdown: `Sesi 2 in ${diff}m`, progress: 100, msg: "Market is currently resting" });
      } else if (currentMin >= 810 && currentMin < 960) {
        // Sesi 2
        const diff = 960 - currentMin - 1;
        const secs = 59 - s;
        const passed = currentMin - 810;
        const progress = (passed / 150) * 100;
        setStatus({ label: "Sesi 2 — Active", countdown: `Closing in ${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}:${String(secs).padStart(2,'0')}`, progress, msg: "Accumulation window open" });
      } else {
        // Closed
        setStatus({ label: "Market Closed", countdown: "Done", progress: 100, msg: "Trading session has ended" });
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface-container-high rounded-xl p-5 w-full md:w-80 shadow-2xl shadow-black/20 border border-outline-variant/5">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">{status.label}</span>
        <span className="text-xs font-black tabular-nums text-primary">{status.countdown}</span>
      </div>
      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div className="h-full bg-primary shadow-[0_0_12px_rgba(173,198,255,0.4)] transition-all duration-1000" style={{ width: `${status.progress}%` }}></div>
      </div>
      <p className="text-[10px] mt-2 text-outline text-right font-medium">{status.msg}</p>
    </div>
  );
};

export default MarketStatus;
