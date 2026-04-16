import React from 'react';

const TopNavBar = () => {
  return (
    <header className="fixed top-0 w-full h-14 z-50 bg-slate-900/60 backdrop-blur-lg flex items-center justify-between px-6 shadow-2xl shadow-blue-900/20 no-border">
      <div className="flex items-center gap-8">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">SahamScreen</h1>
        <div className="hidden md:flex items-center gap-6">
          <span className="text-blue-400 font-semibold cursor-pointer">Markets</span>
          <span className="text-slate-400 hover:text-slate-200 transition-all duration-300 hover:bg-white/5 px-3 py-1 rounded cursor-pointer">Portfolio</span>
          <span className="text-slate-400 hover:text-slate-200 transition-all duration-300 hover:bg-white/5 px-3 py-1 rounded cursor-pointer">Screener</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative bg-surface-container-low px-4 py-1.5 rounded-full flex items-center gap-2 outline-variant/20 outline outline-1">
          <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
          <input 
            className="bg-transparent border-none focus:outline-none text-sm w-48 text-on-surface-variant placeholder-slate-500" 
            placeholder="Search stocks..." 
            type="text"
          />
        </div>
        <button className="material-symbols-outlined text-slate-400 hover:text-slate-200 transition-colors">notifications</button>
        <button className="material-symbols-outlined text-slate-400 hover:text-slate-200 transition-colors">person</button>
      </div>
    </header>
  );
};

export default TopNavBar;
