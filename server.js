const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const helmet = require('helmet');

// small helper to escape HTML in emails
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const app = express();
app.use(helmet());
app.use(express.json());
app.use(require('cors')());

// Basic rate limiter for APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Simple helper to ensure data directory exists
function ensureDataDir() {
  const storeDir = path.join(__dirname, 'data');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  return storeDir;
}

// Simple health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Chat proxy to OpenAI (requires OPENAI_API_KEY in environment)
app.post(
  '/api/chat',
  // validation
  body('message').isString().trim().isLength({ min: 1, max: 2000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid message' });

    const { message } = req.body || {};
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: 'OpenAI API key not configured' });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: message }],
          max_tokens: 350,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: 'Upstream API error', detail: text });
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
      return res.json({ reply });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// Contact endpoint - stores messages locally in data/contacts.json
app.post(
  '/api/contact',
  // Validate inputs
  body('name').optional({ checkFalsy: true }).isString().trim().isLength({ max: 200 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('message').isString().trim().isLength({ min: 1, max: 2000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid input' });

    const { name, email, message } = req.body || {};
    try {
      const storeDir = ensureDataDir();
      const file = path.join(storeDir, 'contacts.json');
      let arr = [];
      if (fs.existsSync(file)) {
        arr = JSON.parse(fs.readFileSync(file, 'utf8')) || [];
      }
      const entry = { name: name || '', email: email || '', message, time: new Date().toISOString() };
      arr.push(entry);
      fs.writeFileSync(file, JSON.stringify(arr, null, 2));

      // If SMTP configured, send an email notification
      if (process.env.SMTP_HOST && process.env.CONTACT_TO) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
          });

          // Build HTML body from template if available
          let htmlBody = null;
          try {
            const tplPath = path.join(__dirname, 'templates', 'contact-email.html');
            if (fs.existsSync(tplPath)) {
              htmlBody = fs.readFileSync(tplPath, 'utf8')
                .replace(/{{\s*time\s*}}/g, escapeHtml(new Date().toISOString()))
                .replace(/{{\s*name\s*}}/g, escapeHtml(name || ''))
                .replace(/{{\s*email\s*}}/g, escapeHtml(email || ''))
                .replace(/{{\s*message\s*}}/g, escapeHtml(message));
            }
          } catch (tplErr) {
            // ignore template errors and fall back to inline html
            // eslint-disable-next-line no-console
            console.error('Template read failed', tplErr);
          }

          const mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@onedayonearth.local',
            to: process.env.CONTACT_TO,
            subject: `Contact form: ${name || 'Anonymous'}`,
            text: `Name: ${name || ''}\nEmail: ${email || ''}\n\n${message}`,
            html: htmlBody || `<p><strong>Name:</strong> ${escapeHtml(name || '')}</p><p><strong>Email:</strong> ${escapeHtml(
              email || ''
            )}</p><hr><p>${escapeHtml(message)}</p>`,
          };

          // Send with retry/backoff
          async function sendWithRetry(opts, attempts = 3) {
            let err = null;
            for (let i = 0; i < attempts; i++) {
              try {
                return await transporter.sendMail(opts);
              } catch (e) {
                err = e;
                const backoff = Math.pow(2, i) * 250; // exponential backoff (ms)
                // eslint-disable-next-line no-console
                console.warn(`Mail send attempt ${i + 1} failed, retrying in ${backoff}ms`);
                await new Promise(r => setTimeout(r, backoff));
              }
            }
            throw err;
          }

          await sendWithRetry(mailOptions, Number(process.env.MAIL_RETRY || 3));
        } catch (mailErr) {
          // log mail errors but do not fail the API
          // eslint-disable-next-line no-console
          console.error('Mail send failed', mailErr);
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// Serve static files from project root (so index.html works when server is started)
app.use(express.static(path.join(__dirname)));

// Optional analytics endpoint (store server-side if ANALYTICS_ENABLED=true)
app.post('/api/analytics', (req, res) => {
  if (process.env.ANALYTICS_ENABLED !== 'true') return res.status(404).json({ error: 'not enabled' });
  try {
    const storeDir = ensureDataDir();
    const file = path.join(storeDir, 'analytics.json');
    let arr = [];
    if (fs.existsSync(file)) arr = JSON.parse(fs.readFileSync(file, 'utf8')) || [];
    const entry = { path: req.body.path || req.path, ts: new Date().toISOString(), ua: req.get('User-Agent') };
    arr.push(entry);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Simple in-memory admin sessions and CSRF tokens
const adminSessions = new Map(); // sessionId -> { csrf, expires }
function makeId(len = 32) {
  return require('crypto').randomBytes(len).toString('hex');
}

// Create a login endpoint for admin that sets a secure HttpOnly session cookie and returns a CSRF token
app.post('/api/admin/login', express.json(), (req, res) => {
  const token = (req.body && req.body.token) || '';
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const sessionId = makeId(16);
  const csrf = makeId(12);
  const expires = Date.now() + 1000 * 60 * 60; // 1 hour
  adminSessions.set(sessionId, { csrf, expires });
  res.cookie('admin_session', sessionId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 });
  return res.json({ ok: true, csrf });
});

function requireAdmin(req, res, next) {
  // 1) Bearer token fallback
  const auth = req.get('Authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  if (process.env.ADMIN_TOKEN && bearer === process.env.ADMIN_TOKEN) return next();

  // 2) Session cookie
  const cookie = (req.get('Cookie') || '').split(';').map(c => c.trim()).find(c => c.startsWith('admin_session='));
  const sessionId = cookie ? cookie.split('=')[1] : null;
  const session = sessionId ? adminSessions.get(sessionId) : null;
  if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'unauthorized' });

  // For state-changing methods, verify CSRF token header
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrf = req.get('x-csrf-token') || req.get('X-CSRF-Token') || '';
    if (!csrf || csrf !== session.csrf) return res.status(403).json({ error: 'invalid csrf' });
  }

  return next();
}

app.get('/api/contacts', requireAdmin, (req, res) => {
  try {
    const storeDir = ensureDataDir();
    const file = path.join(storeDir, 'contacts.json');
    const arr = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    return res.json({ contacts: arr });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Allow admin to clear contacts file
app.delete('/api/contacts', requireAdmin, (req, res) => {
  try {
    const storeDir = ensureDataDir();
    const file = path.join(storeDir, 'contacts.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics', requireAdmin, (req, res) => {
  try {
    const storeDir = ensureDataDir();
    const file = path.join(storeDir, 'analytics.json');
    const arr = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    return res.json({ analytics: arr });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
