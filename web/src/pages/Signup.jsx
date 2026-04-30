import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';
import { api } from '../services/api';

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', { name, email, password });
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage className="flex items-center justify-center min-h-screen bg-background text-on-surface">
      <main className="w-full max-w-[440px] px-6 z-10 relative">
        <div className="bg-surface-variant/40 backdrop-blur-2xl border border-primary/10 p-10 rounded-[2rem] shadow-2xl">
          
          <header className="flex flex-col items-center mb-10">
            <h1 className="text-3xl font-extrabold tracking-tighter mb-1">Sign Up</h1>
            <p className="text-on-surface-variant text-sm font-medium opacity-80">Join SahamScreen Today</p>
          </header>

          <form onSubmit={handleSignup} className="space-y-6">
            {error && (
              <div className="bg-error-container/20 border border-error/50 text-error px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}
            
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Full Name</label>
              <input 
                className="w-full bg-transparent border-0 border-b border-outline-variant/30 py-3 px-4 text-on-surface focus:ring-0 focus:border-primary transition-all outline-none" 
                placeholder="John Doe" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Email</label>
              <input 
                className="w-full bg-transparent border-0 border-b border-outline-variant/30 py-3 px-4 text-on-surface focus:ring-0 focus:border-primary transition-all outline-none" 
                type="email"
                placeholder="name@premium.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Password</label>
              <input 
                className="w-full bg-transparent border-0 border-b border-outline-variant/30 py-3 px-4 text-on-surface focus:ring-0 focus:border-primary transition-all outline-none" 
                type="password"
                placeholder="••••••••••••" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              className="w-full bg-gradient-to-br from-primary to-primary-container py-4 rounded-full text-on-primary font-bold text-sm uppercase tracking-widest hover:scale-[0.98] transition-all" 
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <footer className="mt-8 text-center text-sm">
            <span className="text-on-surface-variant">Already have an account? </span>
            <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
          </footer>
        </div>
      </main>
    </AnimatedPage>
  );
};

export default Signup;
