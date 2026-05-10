import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';
import { api } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link');
    }
  };
  const [error, setError] = useState('');

  return (
    <AnimatedPage className="flex items-center justify-center min-h-screen bg-background text-on-surface">
      <main className="w-full max-w-[440px] px-6 z-10 relative">
        <div className="bg-surface-variant/40 backdrop-blur-2xl border border-primary/10 p-10 rounded-[2rem] shadow-2xl">
          
          <header className="flex flex-col items-center mb-10">
            <h1 className="text-3xl font-extrabold tracking-tighter mb-1">Reset Access</h1>
            <p className="text-on-surface-variant text-sm font-medium opacity-80 text-center">
              {submitted ? "Check your email for reset instructions." : "Enter your email to reset password."}
            </p>
          </header>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-error/10 text-error text-xs font-bold p-3 rounded-lg text-center">
                  {error}
                </div>
              )}
              <div className="group">
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Email Address</label>
                <input 
                  className="w-full bg-transparent border-0 border-b border-outline-variant/30 py-3 px-4 text-on-surface focus:ring-0 focus:border-primary transition-all outline-none" 
                  type="email"
                  placeholder="name@premium.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button 
                className="w-full bg-gradient-to-br from-primary to-primary-container py-4 rounded-full text-on-primary font-bold text-sm uppercase tracking-widest hover:scale-[0.98] transition-all" 
                type="submit"
              >
                Send Reset Link
              </button>
            </form>
          ) : (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-6xl text-primary mb-4">mark_email_read</span>
              <p className="text-on-surface-variant">We've sent a recovery link to <strong>{email}</strong>.</p>
            </div>
          )}

          <footer className="mt-8 text-center text-sm">
            <Link to="/login" className="text-primary font-bold hover:underline">Return to Sign In</Link>
          </footer>
        </div>
      </main>
    </AnimatedPage>
  );
};

export default ForgotPassword;
