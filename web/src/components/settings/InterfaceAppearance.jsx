import React from 'react';

const InterfaceAppearance = ({ theme = 'dark', onChange }) => {
  return (
    <section className="lg:col-span-6 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 backdrop-blur-xl">
      <h3 className="text-xl font-bold mb-6">Interface Appearance</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button 
          onClick={() => onChange('dark')}
          className={`border-2 p-4 rounded-xl bg-slate-900 flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'border-primary-container' : 'border-outline-variant/20 hover:border-primary-container/50'}`}
        >
          <div className="w-full h-8 bg-slate-800 rounded-sm"></div>
          <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}>Dark Mode</span>
        </button>
        <button 
          onClick={() => onChange('light')}
          className={`border-2 p-4 rounded-xl bg-white/5 flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'border-primary-container opacity-100 grayscale-0' : 'border-outline-variant/20 opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
        >
          <div className="w-full h-8 bg-white/20 rounded-sm"></div>
          <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'light' ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}>Light Mode</span>
        </button>
      </div>
      
      <div className="space-y-4">
        <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant font-bold">Data Density</label>
        <div className="flex p-1 bg-surface-container-low border border-outline-variant/10 rounded-xl">
          <button className="flex-1 py-2 text-xs font-bold rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">Relaxed</button>
          <button className="flex-1 py-2 text-xs font-bold rounded-lg bg-surface-container-highest text-primary-fixed-dim shadow-sm">Compact</button>
        </div>
      </div>
    </section>
  );
};

export default InterfaceAppearance;
