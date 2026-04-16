import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = (e) => {
    e.preventDefault();
    login({ email, name: email.split('@')[0], role: 'premium' });
    navigate('/');
  };

  return (
    <AnimatedPage className="flex items-center justify-center min-h-screen overflow-hidden selection:bg-primary selection:text-on-primary bg-background text-on-surface">
      {/* Background Atmospheric Layer */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-surface-container-lowest via-surface to-surface-container-low opacity-90"></div>
        {/* Abstract Market Chart Background */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{ 
            backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAWVW16lecl_UDqADQ3KV6aT8E5u9Sb6OJPEhz_ypile_50VnZ8svXbnq6A25VEcNDsZAyCxvcP61E4S67HctNtoYyBSwGhi5UAKB69PPGcZriwEQZyacbO4sjxQ7rZsEHezVAN-1xukaiUhmZHHw6DAFe2c7UyQFd3N5XiDLFRddUOsjPW3FGEn5i7mylAJz_olzio6nhOFceJbJn9OIWsaov6xaSFOuEB5UvejYj9gAkPgxhAzRdf1VR_AiskojHZdU2o0s8g934')",
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        ></div>
        {/* Atmospheric Glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full"></div>
      </div>

      {/* Login Container */}
      <main className="relative z-10 w-full max-w-[440px] px-6">
        <div className="bg-surface-variant/40 backdrop-blur-2xl border border-primary/10 p-10 rounded-[2rem] shadow-2xl shadow-black/40">
          
          {/* Brand Identity */}
          <header className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20 rotate-3">
              <span className="material-symbols-outlined text-on-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface mb-1">
              Saham<span className="text-primary-fixed-dim">Screen</span>
            </h1>
            <p className="text-on-surface-variant text-sm font-medium tracking-wide opacity-80 uppercase">The Obsidian Lens of Finance</p>
          </header>

          {/* Authentication Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Input */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1" htmlFor="email">Email Address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-outline-variant transition-colors group-focus-within:text-primary">mail</span>
                <input 
                  className="w-full bg-transparent border-0 border-b border-outline-variant/30 py-3 pl-8 pr-4 text-on-surface placeholder:text-outline-variant/50 focus:ring-0 focus:border-primary transition-all tabular-nums outline-none" 
                  id="email" 
                  name="email" 
                  placeholder="name@premium.com" 
                  required 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1" htmlFor="password">Secure Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-outline-variant transition-colors group-focus-within:text-primary">lock</span>
                <input 
                  className="w-full bg-transparent border-0 border-b border-outline-variant/30 py-3 pl-8 pr-4 text-on-surface placeholder:text-outline-variant/50 focus:ring-0 focus:border-primary transition-all outline-none" 
                  id="password" 
                  name="password" 
                  placeholder="••••••••••••" 
                  required 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className="absolute right-0 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface-variant transition-colors" type="button">
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </button>
              </div>
            </div>

            {/* Utilities */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input className="sr-only peer" type="checkbox" />
                  <div className="w-5 h-5 border-2 border-outline-variant rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                  <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
                </div>
                <span className="ml-3 text-on-surface-variant group-hover:text-on-surface transition-colors">Keep me signed in</span>
              </label>
              <a className="text-primary-fixed-dim font-semibold hover:text-primary transition-colors" href="#">Forgot Access?</a>
            </div>

            {/* Primary CTA */}
            <button 
              className="w-full bg-gradient-to-br from-primary to-primary-container py-4 rounded-full text-on-primary font-bold text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center space-x-2" 
              type="submit"
            >
              <span>Sign In</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </form>

          {/* Secondary Actions */}
          <footer className="mt-10 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-surface-container-low/40 rounded-full border border-outline-variant/10">
              <span className="text-on-surface-variant text-sm">New to the platform?</span>
              <a className="ml-2 text-secondary-fixed-dim font-bold text-sm hover:underline" href="#">Sign Up Now</a>
            </div>
          </footer>
        </div>

        {/* Technical Metadata (Visual Fluff) */}
        <div className="mt-8 flex justify-between items-center px-4 opacity-40">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">Encryption</span>
            <span className="text-[10px] font-mono text-secondary-fixed-dim">AES-256-GCM ACTIVE</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">Server Status</span>
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-secondary rounded-full animate-pulse"></div>
              <span className="text-[10px] font-mono text-secondary">NYSE CONNECTED</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Left Corner Decoration */}
      <div className="fixed bottom-8 left-8 z-10 hidden md:block">
        <div className="flex items-center space-x-3 text-on-surface-variant opacity-60">
          <span className="material-symbols-outlined text-xl">language</span>
          <span className="text-xs font-bold tracking-widest uppercase">Global Markets Tier</span>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default Login;
