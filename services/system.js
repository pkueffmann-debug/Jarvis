const os = require('os');

function getSystemInfo() {
  const now    = new Date();
  const total  = os.totalmem();
  const free   = os.freemem();
  const used   = total - free;

  return {
    time:        now.toLocaleTimeString('de-DE'),
    date:        now.toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }),
    dayOfWeek:   now.toLocaleDateString('de-DE', { weekday: 'long' }),
    ram: {
      total:       fmtGB(total),
      used:        fmtGB(used),
      free:        fmtGB(free),
      percentUsed: Math.round((used / total) * 100),
    },
    cpu:    os.cpus()[0]?.model?.split('@')[0].trim() || 'Unbekannt',
    cores:  os.cpus().length,
    uptime: fmtUptime(os.uptime()),
    platform: os.platform(),
    hostname: os.hostname(),
  };
}

function fmtGB(b)  { return `${(b / 1_073_741_824).toFixed(1)} GB`; }
function fmtUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

module.exports = { getSystemInfo };
