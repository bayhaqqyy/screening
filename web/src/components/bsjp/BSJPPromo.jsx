import React from 'react';

const BSJPPromo = () => {
  return (
    <div className="relative group overflow-hidden rounded-xl h-48 shadow-2xl">
      <img className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="stock market" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDBWP4Ek4Bm8oX_nPU6ui5O7G5vdv87mFCreovyKc0S72_AQpQYM9NzSGrV7LkRuMcTFemRUm_4Oxo724b6hs6NJGyWBjDma0Y7R2Mj1ybMdc3EkJO7662EHrbwfLf7kRIrYKSK_0I3DPPyIjISQMsR1hV5FKj1bzU-dWxT2h3Pn0YF8hRD1uAtJJMDvZuL6WnmUKNQxreZfKgJS8wILLw4glEd1ykUeFENkqIsAafoqjS8SuYKoIx9bXVfgJaVv7qZYqE6JTdGM0o" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
      <div className="absolute bottom-4 left-4 right-4">
        <span className="text-[10px] font-black bg-primary text-on-primary px-2 py-0.5 rounded uppercase mb-2 inline-block">Pro Tip</span>
        <h5 className="text-white font-bold leading-tight">Combine BSJP with Haka-Haki signals for 85% accuracy.</h5>
      </div>
    </div>
  );
};

export default BSJPPromo;
