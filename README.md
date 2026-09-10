# OneDayOneEarth — Local development

Quick steps to run the site locally (Node.js + optional server APIs).

Prerequisites
- Node.js 16+ and npm installed

Run locally
1. Install dependencies:

```powershell
cd "c:\Users\HAMILCOR000\Devlopment\WebDev\U1L1"
npm install
```

2. Copy the example environment file and fill values:

```powershell
copy .env.example .env
# edit .env with your editor and provide any needed keys (OPENAI_API_KEY, SMTP_*, ADMIN_TOKEN)
```

3. Start the server:

```powershell
npm start
# or
node server.js
```

4. Open the site in your browser:

http://localhost:3000

Run without installing dependencies
- If you do not need the Node APIs and just want to preview the static site, run the included lightweight server:

```powershell
node server_static.js
```

This uses only Node built-ins and does not require `npm install`.

Notes
- Static files (HTML/CSS/JS) are served from the project root by the Express server in `server.js`.
- To enable the chat proxy, set `OPENAI_API_KEY` in your `.env`.
- To receive contact emails, set SMTP variables and `CONTACT_TO`.
- For admin APIs, set a strong `ADMIN_TOKEN`.

Static deployment
- If you only need static hosting (no server-side APIs), you can deploy the site files (`index.html`, `style.css`, `images/`, etc.) to GitHub Pages, Netlify, or Vercel.

If you want, I can attempt `npm install` and `npm start` here — say "run installs" and I'll try again (may require permission/terminal access). 
# One Day On Earth — Local dev server and optional AI/contact backend

This repository contains a static site and an optional Node/Express server to provide:

- A server-side proxy to OpenAI for the chatbot (`/api/chat`).
- A contact endpoint that stores messages in `data/contacts.json` (`/api/contact`).

Important: The backend is optional. The client-side chatbot will work with canned replies if you do not run the server.

Quick start (local):

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` if you want AI responses.

2. Install dependencies and run:

```bash
npm install
npm start
```

3. Open http://localhost:3000 in your browser.

Contact storage: messages submitted through `/contact.html` are appended to `data/contacts.json`.

Security notes:
- Keep your `OPENAI_API_KEY` secret and do not commit it to source control.
- This server is a minimal example — consider adding rate limiting and authentication before deploying publicly.

Additional optional configuration
- To enable server-side analytics storage, set `ANALYTICS_ENABLED=true` in `.env`. The client will attempt to POST minimal pageview data to `/api/analytics`.
- To enable email notifications for new contact messages, configure SMTP settings in `.env`:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
SMTP_FROM=notifications@yourdomain.com
CONTACT_TO=you@yourdomain.com
```

Notes:
- Email sending is optional; if SMTP is not configured, contact messages are still saved to `data/contacts.json`.
- Rate limiting is enabled by default for API endpoints to help protect against abuse.

Admin dashboard
- Set a secure `ADMIN_TOKEN` in your `.env` (see `.env.example`).
- Visit `/admin.html` and enter the token to view contacts and analytics. The admin endpoints (`/api/contacts` and `/api/analytics`) require the token as a Bearer token in the `Authorization` header.

Removal of unused files
- I can remove unused assets (old drafts and extra images) — I will list candidates and delete only after you confirm which to remove.

Security and deployment notes
- Admin sessions: the server now supports a session login at `POST /api/admin/login` which sets a secure HttpOnly session cookie and returns a CSRF token that the admin UI uses for destructive actions.
- CSRF protection: state-changing admin requests require the `X-CSRF-Token` header.

SMTP improvements
- The contact email sender uses a retry/backoff strategy (configurable via `MAIL_RETRY`) to improve reliability when SMTP servers are flaky.

HTTPS & deployment
- Deploy behind HTTPS in production. If you deploy to a Node host (Heroku, Render, DigitalOcean App Platform), configure `NODE_ENV=production` and set `ADMIN_TOKEN`, `OPENAI_API_KEY` (optional), and SMTP env vars.
- For simple static-only hosting (GitHub Pages, Netlify), you may not need the Node server — features that depend on the server (chat proxy, contact storage, admin dashboard) will be unavailable.


