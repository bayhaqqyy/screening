import React from 'react';

const PromoCard = () => {
  return (
    <div className="relative bg-surface-container-high rounded-2xl p-6 overflow-hidden min-h-[200px] flex flex-col justify-end">
      <img className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" alt="data visualization" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAujQ8PkfUKxqhaFdvAHkPrKP_IJPUewU-Acgbh7rD36AL9DBNOnBcQwAtV5Huwd8jywVZ28KpngNF27Qc0L0OPAblHgC0juTZsB2H4RuTV3Hxmu8KGuXWQez72Rka1EsDaGQaOqNipdCnupZfVy3g47fN_AzcB7ui1F379QLoCGhXZfP0E3YlK_CiSOUtpltr7WNGYFURbbpk6FOTxOrOR98yvexQRzZ1FtR835PqHw9hHZiPYBwuo7NejtEl7XWK8VJlhY7UhbQY" />
      <div className="relative z-10 space-y-2">
        <p className="text-primary font-bold text-lg leading-tight">Advanced Screener<br/>v2.0 Now Live</p>
        <p className="text-xs text-on-surface-variant">Predictive AI algorithms for energy sector stocks.</p>
        <button className="mt-2 text-xs font-bold text-blue-100 flex items-center space-x-1 group">
          <span>Explore Pro Tools</span>
          <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default PromoCard;
