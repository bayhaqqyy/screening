import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ProfileSection = () => {
  const { user } = useAuth();

  return (
    <section className="lg:col-span-8 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <img className="w-24 h-24 rounded-2xl object-cover ring-2 ring-primary/20" alt="profile portrait" src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random`} />
            <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
              <span className="material-symbols-outlined text-white">photo_camera</span>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-on-surface">{user?.name || 'Alex Sterling'}</h2>
            <p className="text-on-surface-variant">{user?.email || 'alex.sterling@saham-pro.com'}</p>
            <div className="mt-2 inline-flex items-center gap-2 bg-secondary/10 px-3 py-1 rounded-full text-secondary text-xs font-bold tracking-widest uppercase">
              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              Premium Tier
            </div>
          </div>
        </div>
        <button className="bg-surface-container-highest text-primary-fixed-dim px-6 py-2 rounded-full font-semibold text-sm hover:bg-surface-variant transition-colors hidden sm:block">
          Edit Profile
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-outline-variant/10">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant font-bold">Trading Experience</label>
          <p className="text-on-surface font-medium tabular-nums">8 Years Professional</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant font-bold">Region</label>
          <p className="text-on-surface font-medium tabular-nums">Global Markets (HK, US, EU)</p>
        </div>
      </div>
    </section>
  );
};

export default ProfileSection;
