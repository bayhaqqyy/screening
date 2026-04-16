import React from 'react';

const FeaturedNews = () => {
  return (
    <article className="lg:col-span-8 group relative rounded-xl overflow-hidden aspect-[16/9] lg:aspect-auto lg:h-[500px]">
      <img className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="stock market" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkSwFYTCXWv-2bcC2ptCWL8msOBazOFjAiM_uopjPMjjY5uSmUfbzfhPmlM8MkcOhkJHbQc_MKYCgjYAXifxtR1ZHwzZDDReLMMU5OQR10Q4U5agEihgfwfYF_fljt5KfsAfsfxV4KVvZiQyZCZ5DwciXq7JwH8xPZjGEp7ZWELqMUxmOZve7GU6FVGyHOc7eEaxWWTfXDXg7JdnZmTnRZG5lgAhtnX5GigCjmu-zT--sGnI3WC5dd4HUDyeQParGPkjkD0c21gFY" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-8 space-y-4 max-w-2xl">
        <div className="flex items-center space-x-3">
          <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase tracking-wider">Positif</span>
          <span className="text-blue-400 text-sm font-semibold">CNBC Indonesia • 12m ago</span>
        </div>
        <h3 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight">IHSG Berpotensi Menguat, Sektor Perbankan Jadi Penopang Utama di Awal Kuartal</h3>
        <p className="text-on-surface-variant line-clamp-2">Analis memprediksi arus modal asing akan terus masuk ke pasar saham domestik seiring dengan stabilitas makroekonomi dan laporan laba emiten yang solid.</p>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded text-[11px] font-bold tabular-nums tracking-wider uppercase">#BBCA</span>
          <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded text-[11px] font-bold tabular-nums tracking-wider uppercase">#BMRI</span>
          <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded text-[11px] font-bold tabular-nums tracking-wider uppercase">#IHSG</span>
        </div>
      </div>
    </article>
  );
};

export default FeaturedNews;
