const { google } = require('googleapis');
const { getAuth } = require('./gmail');

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

async function getEvents({ maxResults = 15, query = '', daysAhead = 7 } = {}) {
  const auth     = await getAuth();
  const cal      = google.calendar({ version: 'v3', auth });
  const timeMin  = new Date().toISOString();
  const timeMax  = new Date(Date.now() + daysAhead * 86_400_000).toISOString();

  const res = await cal.events.list({
    calendarId: 'primary',
    timeMin, timeMax,
    maxResults: Math.min(maxResults, 25),
    singleEvents: true,
    orderBy: 'startTime',
    q: query || undefined,
  });

  const events = (res.data.items || []).map((e) => {
    const isAllDay = !!e.start?.date;
    const start    = e.start?.dateTime || e.start?.date || '';
    const end      = e.end?.dateTime   || e.end?.date   || '';
    return {
      id:          e.id,
      title:       e.summary    || '(kein Titel)',
      start:       isAllDay ? start : new Date(start).toLocaleString('de-DE'),
      end:         isAllDay ? end   : new Date(end).toLocaleString('de-DE'),
      location:    e.location   || null,
      description: (e.description || '').slice(0, 200) || null,
      attendees:   (e.attendees  || []).map((a) => a.displayName || a.email),
      isAllDay,
    };
  });

  return { events, count: events.length };
}

async function createEvent({ title, startTime, endTime, location, description, attendees = [] }) {
  const auth = await getAuth();
  const cal  = google.calendar({ version: 'v3', auth });

  const start = new Date(startTime);
  const end   = endTime ? new Date(endTime) : new Date(start.getTime() + 3_600_000);

  const res = await cal.events.insert({
    calendarId: 'primary',
    resource: {
      summary:     title,
      location,
      description,
      start:     { dateTime: start.toISOString(), timeZone: TZ },
      end:       { dateTime: end.toISOString(),   timeZone: TZ },
      attendees: attendees.map((email) => ({ email })),
    },
  });

  return {
    created: true,
    id:      res.data.id,
    title,
    start:   start.toLocaleString('de-DE'),
    end:     end.toLocaleString('de-DE'),
  };
}

async function deleteEvent({ eventId }) {
  const auth = await getAuth();
  await google.calendar({ version: 'v3', auth }).events.delete({ calendarId: 'primary', eventId });
  return { deleted: true, eventId };
}

module.exports = { getEvents, createEvent, deleteEvent };
