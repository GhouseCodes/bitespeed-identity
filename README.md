# Bitespeed Identity Reconciliation Service

> **Live Endpoint:** `https://bitespeed-identity-p9sh.onrender.com/identify`

> **Note:** Hosted on Render free tier. First request may take 30-50 seconds to wake up. Subsequent requests will be fast.

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /identify | Identity reconciliation |
| GET | /health | Health check |
| GET | / | Service info |

## Test the API

### Identify endpoint
```
POST https://bitespeed-identity-p9sh.onrender.com/identify
Content-Type: application/json

{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

### Expected Response
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

## How It Works

- The oldest matching contact is always `primary`
- New contacts sharing an email or phone are added as `secondary`
- If two separate primaries get linked, the newer one demotes to `secondary`
- No duplicate contacts are created for identical requests

## Tech Stack

- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Hosted on Render.com

## Local Setup
```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

## GitHub Repository

https://github.com/GhouseCodes/bitespeed-identity.git