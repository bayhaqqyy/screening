import React from 'react';

const InterfaceAppearance = () => {
  return (
    <section className="lg:col-span-6 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 backdrop-blur-xl">
      <h3 className="text-xl font-bold mb-6">Interface Appearance</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button className="border-2 border-primary-container p-4 rounded-xl bg-slate-900 flex flex-col items-center gap-2 transition-all hover:border-primary-container/80">
          <div className="w-full h-8 bg-slate-800 rounded-sm"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary-fixed-dim">Dark Mode</span>
        </button>
        <button className="border-2 border-outline-variant/20 p-4 rounded-xl bg-white/5 flex flex-col items-center gap-2 opacity-50 grayscale cursor-not-allowed transition-all">
          <div className="w-full h-8 bg-white/20 rounded-sm"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Light Mode</span>
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
