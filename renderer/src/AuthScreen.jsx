import React, { useState } from 'react';
import { signIn, signUp, resetPassword } from './auth';

export default function AuthScreen({ onAuthenticated }) {
  const [mode,     setMode]     = useState('signin'); // signin | signup | reset
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim()) { setError('E-Mail eingeben.'); return; }

    setLoading(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email.trim());
        setInfo('Reset-Link gesendet — check deine E-Mails.');
        setMode('signin');
        return;
      }
      if (mode === 'signup') {
        if (password.length < 6) { setError('Passwort mindestens 6 Zeichen.'); return; }
        const data = await signUp(email.trim(), password);
        if (data.user && !data.session) {
          setInfo('Bestätigungs-E-Mail gesendet — Link klicken, dann hier einloggen.');
          setMode('signin');
        } else if (data.session) {
          onAuthenticated(data.session);
        }
      } else {
        const data = await signIn(email.trim(), password);
        onAuthenticated(data.session);
      }
    } catch (err) {
      setError(err.message.replace('Invalid login credentials', 'Falsche E-Mail oder Passwort.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0A0A0F] overflow-hidden animate-chat-slide-up">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-8 pb-6 text-center">
        <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center font-black text-xl"
             style={{ background: 'linear-gradient(135deg,#6366F1,#06B6D4)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
          J
        </div>
        <h1 className="text-white font-bold text-lg tracking-wide">JARVIS</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {mode === 'signup' ? '7 Tage kostenlos testen' : mode === 'reset' ? 'Passwort zurücksetzen' : 'Willkommen zurück'}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 flex flex-col justify-start">
        <div className="bg-[#13131A] border border-[rgba(99,102,241,0.15)] rounded-2xl p-5">
          <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-widest mb-4">
            {mode === 'signup' ? 'Account erstellen' : mode === 'reset' ? 'Reset-Link senden' : 'Einloggen'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-Mail"
              className="w-full bg-[#0A0A0F] border border-[rgba(99,102,241,0.2)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[rgba(99,102,241,0.6)] transition-colors"
            />
            {mode !== 'reset' && (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Passwort"
                className="w-full bg-[#0A0A0F] border border-[rgba(99,102,241,0.2)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[rgba(99,102,241,0.6)] transition-colors"
              />
            )}

            {error && <p className="text-red-400 text-xs px-1">{error}</p>}
            {info  && <p className="text-green-400 text-xs px-1">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
            >
              {loading ? '…' : mode === 'signup' ? '7 Tage gratis starten' : mode === 'reset' ? 'Link senden' : 'Einloggen'}
            </button>
          </form>
        </div>

        {/* Mode switches */}
        <div className="flex flex-col gap-2 mt-4 text-center">
          {mode === 'signin' && (
            <>
              <button onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
                      className="text-xs text-zinc-500 hover:text-[#818CF8] transition-colors">
                Noch kein Account? <span className="text-[#818CF8] font-semibold">Registrieren</span>
              </button>
              <button onClick={() => { setMode('reset'); setError(''); setInfo(''); }}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                Passwort vergessen?
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
                    className="text-xs text-zinc-500 hover:text-[#818CF8] transition-colors">
              Zurück zum Login
            </button>
          )}
        </div>

        {mode === 'signup' && (
          <p className="text-center text-zinc-700 text-[10px] mt-4 px-4 leading-relaxed">
            Nach der Registrierung erhältst du eine Bestätigungs-E-Mail.
            Nach dem Login starten deine 7 Tage Trial automatisch.
          </p>
        )}
      </div>
    </div>
  );
}
