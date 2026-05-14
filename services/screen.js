const { execSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const isDarwin  = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

function captureMac(dest) {
  execSync(`screencapture -x "${dest}"`, { timeout: 5000 });
}

function resizeMac(dest) {
  execSync(`sips -Z 1440 "${dest}" --out "${dest}" 2>/dev/null || true`, { timeout: 5000 });
}

function captureWin(dest) {
  const escaped = dest.replace(/\\/g, '\\\\');
  const ps =
    `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ` +
    `$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; ` +
    `$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height); ` +
    `$g=[System.Drawing.Graphics]::FromImage($bmp); ` +
    `$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); ` +
    `$bmp.Save('${escaped}'); $g.Dispose(); $bmp.Dispose()`;
  execSync(
    `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
    { timeout: 8000 }
  );
}

async function analyzeScreen(question = 'Was ist auf diesem Bildschirm zu sehen? Beschreibe alles detailliert.') {
  if (!isDarwin && !isWindows) {
    return { error: 'Screen-Analyse auf dieser Plattform nicht unterstützt.' };
  }

  const tmpPath = path.join(os.tmpdir(), `jarvis_screen_${Date.now()}.png`);
  try {
    if (isDarwin) {
      captureMac(tmpPath);
      resizeMac(tmpPath);
    } else {
      captureWin(tmpPath);
    }

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
