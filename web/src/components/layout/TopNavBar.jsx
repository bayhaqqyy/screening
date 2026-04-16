import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const TopNavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        
        <div className="relative" ref={menuRef}>
          <button 
            className="material-symbols-outlined text-slate-400 hover:text-slate-200 transition-colors w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center border border-outline-variant/30"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            person
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-3 w-64 bg-surface-container-high border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl z-50"
              >
                <div className="p-4 border-b border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary font-bold shadow-md">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface truncate w-36">{user?.name || 'User'}</span>
                      <span className="text-xs text-on-surface-variant truncate w-36">{user?.email || 'user@example.com'}</span>
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-primary/10 text-primary-fixed-dim px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    Premium Member
                  </div>
                </div>
                
                <div className="p-2 space-y-1">
                  <button 
                    onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                    <span>Account Settings</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-xl transition-all">
                    <span className="material-symbols-outlined text-[20px]">help</span>
                    <span>Support</span>
                  </button>
                </div>
                
                <div className="p-2 border-t border-outline-variant/10">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error hover:bg-error/10 hover:text-error rounded-xl transition-all font-medium"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar;
