# Clifton Feedback

Anonymous peer feedback tool built for Hilti teams. Team members rate each other on the 4 CliftonStrengths domains and share written feedback — completely anonymously, with end-to-end encryption so nobody (including admins) can read anyone else's results.

---

## What It Does

- **Manager creates a team** and gets one invite link to share with the group
- **Members self-register** by opening the link and entering their name
- **Manager opens the feedback round** once everyone has joined
- **Each member rates all teammates** on 4 CliftonStrengths domains (1–5) and writes one strength + one area to grow
- **Each member views their own results** via a private link — nobody else can access it, not even the admin

Designed to work for all teams at Hilti: up to 5 teams, 10–20 members each.

---

## CliftonStrengths Domains

Each teammate is rated 1–5 on:

| Domain | What it measures |
|--------|-----------------|
| **Executing** | Gets things done, follows through, delivers results |
| **Relationship Building** | Builds strong teams, creates trust, brings people together |
| **Influencing** | Sells ideas, speaks up, drives others to act |
| **Strategic Thinking** | Absorbs information, thinks ahead, makes better decisions |

---

## Privacy & Anonymity Guarantees

| Threat | Protection |
|--------|-----------|
| Who wrote what | `submitterId` column does not exist in the database — ever |
| Admin reading results | Admin API never returns view tokens or feedback content |
| DB breach exposing feedback | All feedback is **end-to-end encrypted** in the browser before reaching the server |
| Guessing someone's results link | Links contain 256-bit random secrets — not guessable |
| Submitting twice | Token marked used on first submission, returns error on retry |

### How end-to-end encryption works (simple version)

When Alice joins, her browser generates a key pair (public + private). Her **public key** goes to the server — it can only encrypt, not decrypt. Her **private key** is encrypted with a secret (`viewSecret`) that only Alice has, and that locked version goes to the server.

When Bob submits feedback about Alice, his browser encrypts it using Alice's public key. The server stores the encrypted blob — it cannot read it.

When Alice opens her results link (which contains her `viewSecret`), her browser fetches the encrypted private key, unlocks it using `viewSecret`, then uses the private key to decrypt all her feedback. The server never sees plaintext.

**The database contains:** public keys, encrypted private keys, encrypted feedback blobs — none of which are readable without the `viewSecret` that only the recipient has.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 19 (standalone components, lazy-loaded routes) |
| Backend | Node.js + Express |
| ORM | Prisma |
| Database | PostgreSQL (production) |
| Encryption | WebCrypto API — ECDH P-256 + AES-GCM 256 + HKDF + SHA-256 |
| Hosting | Render.com |

---

## Project Structure

```
clifton-feedback/
├── render.yaml                     Render deployment config
├── backend/
│   ├── src/
│   │   ├── app.js                  Express entry point
│   │   └── routes/
│   │       ├── admin.js            Team management endpoints
│   │       ├── join.js             Self-registration endpoint
│   │       ├── submit.js           Feedback submission endpoints
│   │       └── results.js          Results retrieval endpoint
│   ├── prisma/
│   │   └── schema.prisma           Database schema
│   └── package.json
└── frontend/
    └── src/app/
        ├── admin/                  Create team + manage members
        ├── join/                   Self-registration + key generation
        ├── submit/                 Feedback form (encrypts in browser)
        ├── results/                Results page (decrypts in browser)
        └── shared/services/
            ├── api.service.ts      All HTTP calls
            └── crypto.service.ts  All encryption/decryption logic
```

---

## Database Schema

```
Team
  id           — unique identifier
  name         — team display name
  adminToken   — secret token for the admin dashboard URL
  inviteToken  — token for the public invite link
  feedbackOpen — false (registration phase) → true (feedback phase)

Member
  id                  — unique identifier
  name                — display name
  submitToken         — one-time token to access the feedback form
  publicKeyJwk        — ECDH public key (safe to store, only encrypts)
  encryptedPrivateKey — private key locked with the member's viewSecret
  privateKeyIv        — IV used to encrypt the private key
  viewTokenHash       — SHA-256(viewSecret), used for lookup only
  hasSubmitted        — whether they have submitted feedback

Feedback
  targetMemberId  — who received this feedback
  ephemeralPubKey — submitter's one-time ECDH public key
  encryptedData   — AES-GCM ciphertext (ratings + written feedback)
  iv              — IV used for encryption
  ← no submitterId column — anonymity enforced at schema level
```

---

## API Endpoints

| Method | Path | Who calls it | What it does |
|--------|------|-------------|--------------|
| `POST` | `/api/admin/teams` | Admin | Create a new team |
| `GET` | `/api/admin/:adminToken` | Admin | Get team overview + completion stats |
| `POST` | `/api/admin/:adminToken/members` | Admin | Manually add a member |
| `DELETE` | `/api/admin/:adminToken/members/:id` | Admin | Remove a member (pre-submission only) |
| `POST` | `/api/admin/:adminToken/open` | Admin | Open feedback round (locks registration) |
| `GET` | `/api/join/:inviteToken` | Member | Get team name for join page |
| `POST` | `/api/join/:inviteToken` | Member | Self-register + send public key |
| `GET` | `/api/submit/:submitToken` | Member | Get list of teammates + their public keys |
| `POST` | `/api/submit/:submitToken` | Member | Submit encrypted feedback |
| `GET` | `/api/results/:viewSecret` | Member | Get encrypted results (decrypted in browser) |

---

## User Flow

```
1. Manager goes to /admin → creates team → gets:
     - Admin link  (bookmark this to manage the team)
     - Invite link (share this with the whole team — one link for everyone)

2. Manager posts invite link in team group chat

3. Each member (including manager) opens the invite link:
     - Types their name
     - Browser generates encryption keys silently
     - Shown their private results link — must save/bookmark it
     - Redirected to their personal feedback form

4. Manager opens the feedback round from /admin once everyone has joined
     - This locks registration and enables submissions

5. Each member fills out feedback for all teammates:
     - 4 star ratings (1–5)
     - One thing they're great at (text)
     - One area to grow (text)
     - All encrypted in the browser before sending

6. Each member views their own results via their saved link:
     - Average scores per domain
     - All written feedback as an anonymous list
     - Decrypted locally — server never saw the plaintext
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- A PostgreSQL database — easiest option: create a free project at [neon.tech](https://neon.tech)

### Setup

```bash
# 1. Clone and install dependencies
git clone <your-repo>
cd clifton-feedback

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and set DATABASE_URL to your PostgreSQL connection string

# 3. Set up backend
cd backend
npm install
npx prisma migrate dev --name init
npm run dev        # starts on port 3000

# 4. In a new terminal, set up frontend
cd frontend
npm install
npm start          # starts on port 4200, proxies /api to port 3000
```

Open [http://localhost:4200](http://localhost:4200)

---

## Deploying to Render

### One-time setup

1. Push this repo to GitHub

2. Go to [render.com](https://render.com) and sign up (GitHub login works)

3. Click **New** → **Blueprint** → connect your GitHub repo

4. Render reads `render.yaml` and automatically creates:
   - A PostgreSQL database
   - A Node.js web service (builds frontend + backend, runs migrations, starts server)

5. Click **Apply** — deployment takes ~3 minutes

Your app will be live at `https://clifton-feedback.onrender.com` (or similar URL shown in Render dashboard).

### Environment variables set automatically by render.yaml

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Auto-wired from the Render PostgreSQL instance |

### Free tier notes

- Web service sleeps after 15 minutes of inactivity, wakes in ~30 seconds on next request
- PostgreSQL: 1GB storage, free for 90 days then $7/month
- Upgrade to a paid web service ($7/month) to avoid cold starts

---

## .env.example

```
DATABASE_URL="postgresql://user:password@host:5432/clifton_feedback"
NODE_ENV="development"
```

---

## Security Notes

- Feedback content is encrypted end-to-end using the **WebCrypto API** (built into all modern browsers, no library)
- The server is a pass-through for encrypted blobs — it has no ability to decrypt feedback
- `viewSecret` (the decryption key) is only ever in the member's saved URL — never stored on the server
- Even with full database access, an attacker sees only ciphertext, public keys, and hashes
- The only attack vector is compromising a member's saved results URL

---

## Known Limitations

- If a member loses their results link, results cannot be recovered (the decryption key is not stored anywhere server-side)
- Members added manually by the admin (instead of via invite link) cannot receive encrypted feedback as they have no key pair — they should self-register via the invite link instead
- Free Render tier has cold starts (~30s) after periods of inactivity
