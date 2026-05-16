import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import HudCanvas from './HudCanvas';

// Lazy: leaflet pulls in CSS + a large bundle. Loading it eagerly at app
// boot has caused renderer crashes on macOS Electron 28. Only load when
// a map is actually requested.
const MapView = lazy(() => import('./MapView'));

// 500×500 HUD window. When a map is open, the parent (App.jsx) switches
// `mapData` in and the layout grows to row(900 map + 350 hud).
export default function HudWindow({
  voiceState,
  mapData,            // { city, lat, lon } or null
  onClose,
  onCloseMap,
}) {
  const [startupAt, setStartupAt] = useState(() => performance.now());
  const [shutdownAt, setShutdownAt] = useState(null);
  const closedRef = useRef(false);

  // Re-trigger startup animation on (re)mount
  useEffect(() => {
    setStartupAt(performance.now());
    setShutdownAt(null);
    closedRef.current = false;
  }, []);

  // hud:close still triggers exit animation. hud:open is intentionally
  // ignored after mount — OWW can fire many false-positives per minute
  // and resetting startupAt on each one keeps entrance permanently at 0.
  useEffect(() => {
    const handleClose = () => { setShutdownAt(performance.now()); };
    window.jarvis?.onHudClose?.(handleClose);
    return () => window.jarvis?.offHudEvents?.();
  }, []);

  function handleShutdownComplete() {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose?.();
  }

  function handleManualClose() {
    if (shutdownAt) return;
    setShutdownAt(performance.now());
  }

  // Map mode: map (900) + smaller HUD (350×350 area in a 400-wide panel)
  if (mapData) {
    return (
      <div style={{
        width: 1300, height: 700,
        background: '#000000',
        display: 'flex', flexDirection: 'row',
        WebkitAppRegion: 'drag',
        overflow: 'hidden',
      }}>
        <div style={{ width: 900, height: 700, position: 'relative', WebkitAppRegion: 'no-drag' }}>
          <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#000' }} />}>
            <MapView city={mapData.city} lat={mapData.lat} lon={mapData.lon} />
          </Suspense>
        </div>
        <div style={{
          width: 400, height: 700,
          background: '#000000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <button
            onClick={onCloseMap}
            aria-label="Karte schließen"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255, 107, 0, 0.15)',
              border: '1px solid rgba(255, 107, 0, 0.4)',
              color: '#FF6B00',
              fontSize: 12, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitAppRegion: 'no-drag',
              fontFamily: 'monospace', fontWeight: 700,
            }}
          >×</button>
          <HudCanvas size={350} state={voiceState} startupAt={startupAt} shutdownAt={shutdownAt} onShutdownComplete={handleShutdownComplete} />
        </div>
      </div>
    );
  }

  // Normal 1100×620 HUD (Stark OS layout)
  return (
    <div style={{
      width: 1100, height: 620,
      position: 'relative',
      background: '#000000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      WebkitAppRegion: 'drag',
      overflow: 'hidden',
    }}>
      <button
        onClick={handleManualClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 12, right: 12,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0, 220, 255, 0.12)',
          border: '1px solid rgba(0, 220, 255, 0.45)',
          color: 'rgba(120, 235, 255, 0.95)',
          fontSize: 14, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitAppRegion: 'no-drag',
          fontFamily: 'monospace', fontWeight: 700,
          zIndex: 10,
        }}
      >×</button>

      <HudCanvas
        width={1100}
        height={620}
        state={voiceState}
        startupAt={startupAt}
        shutdownAt={shutdownAt}
        onShutdownComplete={handleShutdownComplete}
      />
    </div>
  );
}
