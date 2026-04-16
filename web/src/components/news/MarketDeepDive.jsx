import React from 'react';

const mockFeed = [
  {
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxRIhCD1sOK3b5lvCBvPO-Qpp3DcK8QsLXx2ByZCgDAJh54HClcOBb128htIdPa-LHip9wXX6oUazIrcMHUQY6a5oh7M72PQvaRoi4CRIu34v28WTC3_BbYgIWVJ3CoqWvQsKjs3TvXdflhbZL3sVkvi5WSNiIBn3XtmKhYX-E_jceBHcuWpy5NnEX6EYGoNGcLQCXsi3qtrt2XOgv136CGJrssF0kgkl28k2Hk-9bKS1sVPKwZYy7-GE17FMUTdKri-lTbj1HyA4',
    sentiment: 'Positif', sentimentClass: 'bg-secondary-container text-on-secondary-container',
    source: 'Investing.com • 3 hours ago',
    title: 'Komoditas Emas Capai Rekor Baru, Analis: Safe Haven Tetap Jadi Pilihan Utama',
    desc: 'Kenaikan harga emas didorong oleh ketegangan geopolitik dan ekspektasi penurunan suku bunga Fed di akhir tahun.',
    tags: ['#GOLD', '#COMMODITIES']
  },
  {
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB86aTIZ30_ZkMjaS3OBN0R4qUvczZeHPcDWpV9I30X7AykgjWVLQd8n1MJW2yHz4NgTUsBkDmtmM8rIEwQL3mSmJkNfKNI9JD4gC23_CngyjrwUjDVHz2X91zx0U2Uynm-tK6fUiq1j5fzEfiS2E7OspTap2K1-4K1XlOgyILjFSWMahKe9wbaFhtBMONypvTkxHihUvvVuci6KuuUm80JZ6biRXHrg__zNE5ETxl7izEiEcs__wprdpWxxvMAEbtGbiRUHulGlNU',
    sentiment: 'Negatif', sentimentClass: 'bg-error-container text-on-error-container',
    source: 'Detik Finance • 5 hours ago',
    title: 'Sektor Properti Masih Lesu, Insentif PPN DTP Diharapkan Mampu Genjot Penjualan',
    desc: 'Beberapa emiten properti mencatatkan penurunan marketing sales di kuartal ketiga akibat daya beli yang tertahan.',
    tags: ['#BSDE', '#CTRA']
  }
];

const MarketDeepDive = () => {
  return (
    <section className="space-y-6 pt-4">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <h3 className="text-xl font-bold tracking-tight">Market Deep Dive</h3>
        <button className="text-sm font-semibold text-blue-400 hover:underline">View All Archive</button>
      </div>
      
      <div className="space-y-3">
        {mockFeed.map((news, idx) => (
          <div key={idx} className="glass-panel p-5 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row gap-6 items-center hover:bg-surface-container-high/40 transition-colors cursor-pointer group">
            <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden shrink-0">
              <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="news thumbnail" src={news.image} />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-3">
                <span className={`${news.sentimentClass} text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase`}>{news.sentiment}</span>
                <span className="text-[11px] text-on-surface-variant font-medium">{news.source}</span>
              </div>
              <h4 className="text-lg font-bold group-hover:text-blue-400 transition-colors">{news.title}</h4>
              <p className="text-sm text-on-surface-variant line-clamp-1">{news.desc}</p>
              <div className="flex gap-2 pt-1">
                {news.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold tabular-nums px-2 py-0.5 bg-surface-container-lowest rounded-full border border-outline-variant/30">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="hidden md:block shrink-0 px-4">
              <span className="material-symbols-outlined text-outline group-hover:translate-x-1 group-hover:text-blue-400 transition-all">arrow_forward_ios</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MarketDeepDive;
