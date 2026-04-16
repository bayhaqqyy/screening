import React from 'react';

const WatchlistNav = () => {
  return (
    <div className="flex justify-between items-end mb-8 mt-4">
      <div className="space-y-4">
        <div className="flex space-x-1 p-1 bg-surface-container-low rounded-xl w-fit">
          <button className="px-6 py-2 rounded-lg text-sm font-semibold bg-surface-container-highest text-primary shadow-sm transition-all">Banking</button>
          <button className="px-6 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface transition-all">Tech</button>
          <button className="px-6 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface transition-all">Energy</button>
        </div>
      </div>
      <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-bold shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all">
        <span className="material-symbols-outlined">add_circle</span>
        <span>Add Ticker</span>
      </button>
    </div>
  );
};

export default WatchlistNav;
