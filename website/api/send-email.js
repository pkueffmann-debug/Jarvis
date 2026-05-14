const { Resend } = require('resend');

// ── Templates ──────────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', Helvetica, sans-serif;
  background: #000; color: #fff; margin: 0; padding: 0;
`;

function wrapTemplate(innerHtml) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JARVIS</title>
</head>
<body style="${BASE_STYLE}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:36px 36px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="display:inline-block;font-size:20px;font-weight:800;letter-spacing:0.12em;color:#fff;">
                JAR<span style="color:#6366F1;">V</span>IS
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;color:#fff;font-size:15px;line-height:1.65;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#52525B;font-size:11px;line-height:1.6;">
              JARVIS — Ihr persönlicher KI-Assistent.<br>
              <span style="color:#3F3F46;">Diese E-Mail wurde automatisch versandt.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function confirmationTemplate({ confirmUrl }) {
  if (!confirmUrl) throw new Error('confirmUrl ist für template "confirmation" erforderlich.');
  return wrapTemplate(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff;">Konto bestätigen</h1>
    <p style="margin:0 0 8px;color:#A1A1AA;">Guten Tag, Sir.</p>
    <p style="margin:0 0 24px;color:#A1A1AA;">
      Vielen Dank für Ihre Registrierung bei JARVIS. Klicken Sie auf den Button unten, um Ihre E-Mail-Adresse zu bestätigen und Ihre 7-tägige Trial-Phase zu starten.
    </p>
    <p style="margin:0 0 28px;text-align:center;">
      <a href="${confirmUrl}"
         style="display:inline-block;padding:13px 28px;background:#6366F1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">
        E-Mail-Adresse bestätigen
      </a>
    </p>
    <p style="margin:0 0 8px;color:#52525B;font-size:12px;">
      Funktioniert der Button nicht? Kopieren Sie diesen Link in Ihren Browser:
    </p>
    <p style="margin:0;color:#6366F1;font-size:12px;word-break:break-all;">
      <a href="${confirmUrl}" style="color:#818CF8;">${confirmUrl}</a>
    </p>
  `);
}

function welcomeTemplate() {
  return wrapTemplate(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff;">Willkommen bei JARVIS</h1>
    <p style="margin:0 0 8px;color:#A1A1AA;">Guten Tag, Sir.</p>
    <p style="margin:0 0 24px;color:#A1A1AA;">
      Ihr JARVIS-Konto wurde erfolgreich eingerichtet. Sie können sich nun anmelden und Ihre 7-tägige Trial-Phase nutzen.
    </p>
    <p style="margin:0 0 28px;text-align:center;">
      <a href="https://jarvis-kappa-rosy.vercel.app/auth.html"
         style="display:inline-block;padding:13px 28px;background:#6366F1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">
        Zur Anmeldung
      </a>
    </p>
    <p style="margin:0;color:#52525B;font-size:12px;">
      Bei Fragen antworten Sie einfach auf diese E-Mail.
    </p>
  `);
}

const TEMPLATES = {
  confirmation: confirmationTemplate,
  welcome:      welcomeTemplate,
};

// ── Handler ────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY ist nicht gesetzt (Vercel → Settings → Environment Variables).' });
  }

  const body = req.body || {};
  const to       = typeof body.to === 'string' ? body.to.trim() : '';
  const subject  = typeof body.subject === 'string' ? body.subject.trim() : '';
  const template = typeof body.template === 'string' ? body.template : '';
  const html     = typeof body.html === 'string' ? body.html : '';

  if (!to)      return res.status(400).json({ error: 'Feld "to" fehlt.' });
  if (!subject) return res.status(400).json({ error: 'Feld "subject" fehlt.' });
  if (!html && !template) {
    return res.status(400).json({ error: 'Entweder "html" oder "template" muss gesetzt sein.' });
  }
  if (template && !TEMPLATES[template]) {
    return res.status(400).json({ error: `Unbekanntes Template "${template}". Verfügbar: ${Object.keys(TEMPLATES).join(', ')}` });
  }

  let renderedHtml;
  try {
    renderedHtml = template ? TEMPLATES[template](body) : html;
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const from = process.env.RESEND_FROM_EMAIL || 'JARVIS <noreply@jarvis-ai.app>';

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: renderedHtml,
    });
    if (error) {
      console.error('[Resend]', error);
      return res.status(500).json({ error: error.message || 'Resend-Fehler.' });
    }
    return res.status(200).json({ ok: true, id: data?.id });
  } catch (e) {
    console.error('[Resend]', e);
    return res.status(500).json({ error: e.message });
  }
};
