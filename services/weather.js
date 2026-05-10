const WMO_CODES = {
  0:'Klar', 1:'Überwiegend klar', 2:'Teilweise bewölkt', 3:'Bedeckt',
  45:'Nebel', 48:'Reifnebel',
  51:'Leichter Nieselregen', 53:'Mäßiger Nieselregen', 55:'Starker Nieselregen',
  61:'Leichter Regen', 63:'Mäßiger Regen', 65:'Starker Regen',
  71:'Leichter Schneefall', 73:'Mäßiger Schneefall', 75:'Starker Schneefall',
  80:'Leichte Regenschauer', 81:'Mäßige Regenschauer', 82:'Starke Regenschauer',
  95:'Gewitter', 96:'Gewitter mit Hagel', 99:'Gewitter mit starkem Hagel',
};

async function geocode(location) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=de&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Ort "${location}" nicht gefunden.`);
  const { latitude, longitude, name, country } = data.results[0];
  return { latitude, longitude, name, country };
}

async function getWeather({ location = 'Berlin', days = 3 }) {
  try {
    const daysN = Math.min(Number(days) || 3, 7);
    const geo = await geocode(location);

    const params = new URLSearchParams({
      latitude:  geo.latitude,
      longitude: geo.longitude,
      current_weather: 'true',
      daily: 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max',
      timezone: 'auto',
      forecast_days: daysN,
    });

    const res  = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const data = await res.json();

    const cur = data.current_weather;
    const daily = data.daily;

    const forecast = daily.time.map((date, i) => ({
      date,
      maxTemp:  daily.temperature_2m_max[i],
      minTemp:  daily.temperature_2m_min[i],
      condition: WMO_CODES[daily.weathercode[i]] || 'Unbekannt',
      precipitation: daily.precipitation_sum[i],
      maxWind: daily.windspeed_10m_max[i],
    }));

    return {
      location: `${geo.name}, ${geo.country}`,
      current: {
        temp:      cur.temperature,
        windspeed: cur.windspeed,
        condition: WMO_CODES[cur.weathercode] || 'Unbekannt',
        isDay:     cur.is_day === 1,
      },
      forecast,
    };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { getWeather };
