import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Leaf, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = mode === 'login'
      ? await login(email, password)
      : await register(email, password, name);
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4" data-testid="auth-page">
      <div className="w-full max-w-md">
        {/* Hero section */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="w-20 h-20 rounded-3xl bg-[#F0F4F1] border border-[#E6DFD4] flex items-center justify-center mx-auto mb-6">
            <Leaf className="w-10 h-10 text-[#6B8E78]" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1A2E20] mb-2" style={{ fontFamily: 'Outfit' }}>
            HabitFlow
          </h1>
          <p className="text-[#5C6B61] text-base">
            Build who you want to become, one habit at a time.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-8 animate-fade-in-up stagger-2" data-testid="auth-card">
          {/* Mode Toggle */}
          <div className="flex bg-[#F0F4F1] rounded-xl p-1 mb-8">
            <button
              data-testid="auth-login-tab"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-white text-[#1A2E20] shadow-sm'
                  : 'text-[#5C6B61] hover:text-[#1A2E20]'
              }`}
            >
              Sign In
            </button>
            <button
              data-testid="auth-register-tab"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-white text-[#1A2E20] shadow-sm'
                  : 'text-[#5C6B61] hover:text-[#1A2E20]'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs tracking-[0.2em] uppercase font-semibold text-[#5C6B61] mb-2">Your Name</label>
                <input
                  data-testid="auth-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  className="w-full px-5 py-4 bg-[#F9F8F6] border border-[#E6DFD4] rounded-xl text-[#1A2E20] placeholder:text-[#B0AFA9] focus:outline-none focus:border-[#C86B53] focus:ring-2 focus:ring-[#C86B53]/10 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs tracking-[0.2em] uppercase font-semibold text-[#5C6B61] mb-2">Email</label>
              <input
                data-testid="auth-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-5 py-4 bg-[#F9F8F6] border border-[#E6DFD4] rounded-xl text-[#1A2E20] placeholder:text-[#B0AFA9] focus:outline-none focus:border-[#C86B53] focus:ring-2 focus:ring-[#C86B53]/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs tracking-[0.2em] uppercase font-semibold text-[#5C6B61] mb-2">Password</label>
              <div className="relative">
                <input
                  data-testid="auth-password-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full px-5 py-4 bg-[#F9F8F6] border border-[#E6DFD4] rounded-xl text-[#1A2E20] placeholder:text-[#B0AFA9] focus:outline-none focus:border-[#C86B53] focus:ring-2 focus:ring-[#C86B53]/10 transition-all pr-12"
                />
                <button
                  type="button"
                  data-testid="auth-toggle-password"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C6B61] hover:text-[#1A2E20] transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div data-testid="auth-error" className="bg-red-50 text-[#D94F4F] text-sm p-4 rounded-xl border border-red-100 animate-scale-in">
                {error}
              </div>
            )}

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#C86B53] hover:bg-[#B35A44] text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] shadow-lg shadow-[#C86B53]/20"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[#5C6B61] text-sm mt-6 animate-fade-in-up stagger-3">
          Your habits are synced across all devices
        </p>
      </div>
    </div>
  );
}
