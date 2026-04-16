import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', path: '/' },
  { name: 'Scalping', icon: 'bolt', path: '/scalping' },
  { name: 'Swing', icon: 'trending_up', path: '/swing' },
  { name: 'BSJP', icon: 'query_stats', path: '/bsjp' },
  { name: 'News', icon: 'article', path: '/news' },
  { name: 'Watchlist', icon: 'visibility', path: '/watchlist' },
];

const SideNavBar = () => {
  return (
    <nav className="fixed left-0 top-14 h-full w-60 z-40 bg-slate-950 flex flex-col pt-4 shadow-right shadow-black/50 no-border font-sans text-sm tracking-wide">
      <div className="px-6 mb-6">
        <p className="text-lg font-black text-blue-400">SahamScreen</p>
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Premium Trading</p>
      </div>
      
      <div className="space-y-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 py-3 px-6 transition-colors ${
                isActive 
                  ? 'text-blue-400 bg-blue-400/10 border-r-2 border-blue-400' 
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
        
        <div className="pt-10">
          <NavLink
            to="/settings"
            className={({ isActive }) => 
              `flex items-center gap-3 py-3 px-6 transition-colors ${
                isActive 
                  ? 'text-blue-400 bg-blue-400/10 border-r-2 border-blue-400' 
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <span className="material-symbols-outlined">settings</span>
            Settings
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default SideNavBar;
