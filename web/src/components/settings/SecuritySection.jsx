import React from 'react';

const SecuritySection = () => {
  return (
    <section className="lg:col-span-4 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 self-stretch backdrop-blur-xl">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">security</span>
        Security
      </h3>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-on-surface">2FA Authentication</p>
            <p className="text-xs text-secondary-fixed-dim">Enabled via Authenticator</p>
          </div>
          <span className="material-symbols-outlined text-secondary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
