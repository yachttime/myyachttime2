import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function TabletSignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('Sign-in failed. Check the tablet login details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Helm Tablet Sign-In</h1>
          <p className="text-sm text-slate-400">Use the yacht's tablet login.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="tablet-email" className="block text-sm text-slate-300">Login email</label>
          <input
            id="tablet-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="tablet-password" className="block text-sm text-slate-300">Password</label>
          <input
            id="tablet-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            required
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
