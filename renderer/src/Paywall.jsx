import React, { useState } from 'react';

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    monthly: '49', yearly: '41',
    limit: 'Unbegrenzt',
    features: ['Unbegrenzte Nachrichten', 'Alle Integrationen', '1 Nutzer'],
    cta: 'Pro starten',
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    monthly: '149', yearly: '124',
    limit: 'Unbegrenzt',
    features: ['Unbegrenzte Nachrichten', 'Alle Integrationen', 'Bis 10 Nutzer'],
    cta: 'Team starten',
    highlight: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: '399', yearly: '332',
    limit: 'Unbegrenzt',
    features: ['Unbegrenzte Nachrichten', 'Alle Integrationen', 'Unbegrenzte Nutzer'],
    cta: 'Enterprise starten',
    highlight: false,
  },
];

export default function Paywall({ licenseStatus, onActivated, onContinueFree }) {
  const [keyInput, setKeyInput]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [checkingPlan, setCheckingPlan] = useState(null);
  const [yearly, setYearly]       = useState(false);

  const isTrial   = licenseStatus?.status === 'trial';
  const isFree    = licenseStatus?.status === 'free';
  const isExpired = licenseStatus?.status === 'expired';

  async function handleActivate(e) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await window.jarvis.licenseActivate(keyInput.trim());
      if (result?.valid) {
        setSuccess('Lizenz aktiviert!');
        setTimeout(() => onActivated?.(), 800);
      } else {
        setError(result?.error || 'Ungültiger Lizenzschlüssel.');
      }
    } catch (err) {
      setError('Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(planId) {
    if (planId === 'free') { onContinueFree?.(); return; }
    setCheckingPlan(planId);
    try {
      const url = await window.jarvis.licenseCheckout(planId, yearly);
      if (url) window.jarvis.openExternal(url);
      else setError('Checkout konnte nicht geöffnet werden.');
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setCheckingPlan(null);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0d0d0d] overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">J</div>
            <span className="text-white font-semibold text-sm tracking-wide">JARVIS</span>
          </div>
          {(isFree && licenseStatus.messagesLeft > 0) && (
            <button
              onClick={onContinueFree}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Weiter ({licenseStatus.messagesLeft} verbleibend) →
            </button>
          )}
        </div>

        {/* Status banner */}
        <div className={`mt-3 rounded-xl px-4 py-3 ${
          isTrial   ? 'bg-blue-500/10 border border-blue-500/20' :
          isFree    ? 'bg-amber-500/10 border border-amber-500/20' :
                      'bg-red-500/10 border border-red-500/20'
        }`}>
          {isTrial && (
            <>
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Testphase</p>
              <p className="text-white text-sm">
                Noch <span className="font-bold">{licenseStatus.daysLeft} {licenseStatus.daysLeft === 1 ? 'Tag' : 'Tage'}</span> kostenlos testen.
              </p>
            </>
          )}
          {isFree && (
            <>
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Free-Tier</p>
              <p className="text-white text-sm">
                Heute noch <span className="font-bold">{licenseStatus.messagesLeft} von 50</span> Nachrichten.
              </p>
            </>
          )}
          {isExpired && (
            <>
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Tageslimit erreicht</p>
              <p className="text-white text-sm">Upgrade für unbegrenzte Nutzung.</p>
            </>
          )}
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex-shrink-0 px-5 pb-3 flex items-center justify-center gap-3">
        <span className={`text-xs font-medium transition-colors ${!yearly ? 'text-white' : 'text-zinc-500'}`}>Monatlich</span>
        <button
          onClick={() => setYearly(y => !y)}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${yearly ? 'bg-blue-600' : 'bg-zinc-700'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${yearly ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-xs font-medium transition-colors ${yearly ? 'text-white' : 'text-zinc-500'}`}>
          Jährlich <span className="text-green-400 font-semibold">−17%</span>
        </span>
      </div>

      {/* Plans */}
      <div className="flex-shrink-0 px-5 pb-4 grid grid-cols-2 gap-2.5">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => handleCheckout(plan.id)}
            disabled={checkingPlan === plan.id}
            className={`relative rounded-2xl p-3.5 text-left transition-all active:scale-95 ${
              plan.highlight
                ? 'bg-gradient-to-br from-blue-600 to-violet-700 shadow-lg shadow-blue-500/20 border border-blue-400/30'
                : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Beliebt
              </span>
            )}
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${plan.highlight ? 'text-blue-200' : 'text-zinc-400'}`}>
              {plan.name}
            </p>
            <div className="flex items-baseline gap-0.5 mb-2">
              {plan.monthly === '0' ? (
                <span className={`text-xl font-bold ${plan.highlight ? 'text-white' : 'text-zinc-200'}`}>Gratis</span>
              ) : (
                <>
                  <span className={`text-xl font-bold ${plan.highlight ? 'text-white' : 'text-zinc-200'}`}>€{yearly ? plan.yearly : plan.monthly}</span>
                  <span className={`text-[10px] ${plan.highlight ? 'text-blue-200' : 'text-zinc-500'}`}>/ Monat</span>
                </>
              )}
            </div>
            <p className={`text-[11px] leading-tight mb-2 ${plan.highlight ? 'text-blue-100' : 'text-zinc-400'}`}>
              {plan.limit}
            </p>
            <div className={`text-[10px] font-semibold py-1.5 rounded-lg text-center ${
              plan.highlight
                ? 'bg-white/20 text-white'
                : 'bg-zinc-800 text-zinc-300'
            }`}>
              {checkingPlan === plan.id ? '...' : plan.cta}
            </div>
          </button>
        ))}
      </div>

      {/* License key activation */}
      <div className="flex-shrink-0 px-5 pb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Lizenzschlüssel eingeben</p>
          <form onSubmit={handleActivate} className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="JARVIS-XXXX-XXXX-XXXX"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-blue-500/60 transition-colors font-mono"
            />
            <button
              type="submit"
              disabled={loading || !keyInput.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold px-4 rounded-xl transition-colors"
            >
              {loading ? '...' : 'OK'}
            </button>
          </form>
          {error   && <p className="mt-2 text-red-400 text-xs">{error}</p>}
          {success && <p className="mt-2 text-green-400 text-xs">{success}</p>}
        </div>

        <p className="text-center text-zinc-600 text-[10px] mt-4">
          Nach dem Kauf erhalten Sie Ihren Schlüssel per E-Mail.
        </p>
      </div>
    </div>
  );
}
