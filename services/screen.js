const { execSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

async function analyzeScreen(question = 'Was ist auf diesem Bildschirm zu sehen? Beschreibe alles detailliert.') {
  const tmpPath = path.join(os.tmpdir(), `jarvis_screen_${Date.now()}.png`);
  try {
    // Silent full-screen capture
    execSync(`screencapture -x "${tmpPath}"`, { timeout: 5000 });
    // Resize to max 1440px wide to stay under API limits
    execSync(`sips -Z 1440 "${tmpPath}" --out "${tmpPath}" 2>/dev/null || true`, { timeout: 5000 });

    const base64 = fs.readFileSync(tmpPath).toString('base64');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: question },
        ],
      }],
    });

    return { analysis: resp.content[0].text };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

module.exports = { analyzeScreen };
