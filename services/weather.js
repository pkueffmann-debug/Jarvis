const https = require('https');

const WMO_CODES = {
  0:'Klar', 1:'Überwiegend klar', 2:'Teilweise bewölkt', 3:'Bedeckt',
  45:'Nebel', 48:'Reifnebel',
  51:'Leichter Nieselregen', 53:'Mäßiger Nieselregen', 55:'Starker Nieselregen',
  61:'Leichter Regen', 63:'Mäßiger Regen', 65:'Starker Regen',
  71:'Leichter Schneefall', 73:'Mäßiger Schneefall', 75:'Starker Schneefall',
  80:'Leichte Regenschauer', 81:'Mäßige Regenschauer', 82:'Starke Regenschauer',
  95:'Gewitter', 96:'Gewitter mit Hagel', 99:'Gewitter mit starkem Hagel',
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'JARVIS/1.0' } }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

async function getLocationFromIP() {
  try {
    const data = await get('https://ipapi.co/json/');
    if (data.city && data.latitude && data.longitude) {
      return {
        name:      data.city,
        country:   data.country_name || data.country,
        latitude:  data.latitude,
        longitude: data.longitude,
      };
    }
  } catch {}
  // Hard fallback
  return { name: 'Berlin', country: 'Deutschland', latitude: 52.52, longitude: 13.41 };
}

async function geocode(location) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=de&format=json`;
  const data = await get(url);
  if (!data.results?.length) throw new Error(`Ort "${location}" nicht gefunden.`);
  const { latitude, longitude, name, country } = data.results[0];
  return { latitude, longitude, name, country };
}

async function getWeather({ location, days = 1 }) {
  try {
    const daysN = Math.min(Number(days) || 1, 7);

    // Auto-detect location if not specified
    const geo = (location && location.trim())
      ? await geocode(location.trim())
      : await getLocationFromIP();

    const params = [
      `latitude=${geo.latitude}`,
      `longitude=${geo.longitude}`,
      `current_weather=true`,
      `hourly=apparent_temperature`,
      `daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max`,
      `timezone=auto`,
      `forecast_days=${daysN}`,
    ].join('&');

    const data = await get(`https://api.open-meteo.com/v1/forecast?${params}`);

    const cur       = data.current_weather;
    const condition = WMO_CODES[cur.weathercode] || 'Unbekannt';
    const city      = `${geo.name}, ${geo.country}`;
    const temp      = Math.round(cur.temperature);
    const wind      = Math.round(cur.windspeed);

    // Build daily forecast
    const daily = data.daily;
    const forecast = daily.time.map((date, i) => ({
      date,
      maxTemp:       Math.round(daily.temperature_2m_max[i]),
      minTemp:       Math.round(daily.temperature_2m_min[i]),
      condition:     WMO_CODES[daily.weathercode[i]] || 'Unbekannt',
      precipitation: daily.precipitation_sum[i],
      maxWind:       Math.round(daily.windspeed_10m_max[i]),
    }));

    // Ready-to-use sentence for JARVIS
    const summary = daysN === 1
      ? `Gerade sind es ${temp}°C in ${geo.name} — ${condition}. Wind: ${wind} km/h.`
      : `Aktuell ${temp}°C in ${geo.name}, ${condition}. Wind: ${wind} km/h. Die nächsten Tage: ${forecast.map(d => `${d.date}: ${d.minTemp}–${d.maxTemp}°C, ${d.condition}`).join(' | ')}.`;

    return {
      summary,
      location: city,
      current: { temp, windspeed: wind, condition, isDay: cur.is_day === 1 },
      forecast,
    };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { getWeather };
