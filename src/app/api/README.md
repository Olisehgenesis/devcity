# DEVCITY26 API Routes

Backend API endpoints for the DEVCITY26 platform.

## Endpoints

### Drops

**GET /api/drops**
- List all active drops
- Query params: `eventId`, `status` (active|expired|full)
- Returns: `{ drops: Drop[] }`

**POST /api/drops** (admin)
- Create a new drop
- Body: `{ tokenId, amountPerClaim, maxClaimants, expiresAt, location, eligibility }`
- Returns: `{ drop: Drop }`

### Claims

**POST /api/claims/authorize**
- Backend validates eligibility and signs claim authorization
- Body: `{ dropId, userAddress, qrCode?, location? }`
- Returns: `{ dropId, userAddress, nonce, expiresAt, signature }`
- Frontend submits signature to `DropClaim.claim()` on-chain

**GET /api/claims?userAddress=0x...**
- Get claim history for a user
- Returns: `{ claims: Claim[] }`

### Presence

**POST /api/presence/update**
- Update user's presence status and location
- Body: `{ userAddress, status, visibility, location }`
- Returns: `{ userAddress, status, visibility, location, updatedAt }`
- Note: Location is rounded based on visibility setting

**GET /api/presence/nearby?lat=X&lng=Y&radius=1&visibility=approximate**
- Get nearby users (respecting privacy settings)
- Returns: `{ nearbyUsers: User[] }`

### Broadcasts

**GET /api/broadcasts?eventId=X&limit=20&offset=0**
- Get city feed (broadcasts from nearby users)
- Returns: `{ broadcasts: Broadcast[], total: number }`

**POST /api/broadcasts**
- Create a new broadcast
- Body: `{ userAddress, text, eventId }`
- Returns: `{ broadcast: Broadcast }`

## Implementation Notes

### Database

Use Prisma with PostgreSQL:
```bash
npm install @prisma/client
npx prisma migrate dev
```

Schema already defined in `prisma/schema.prisma`.

### Authentication

- Use wallet address as user ID
- Verify signatures for sensitive operations
- TODO: Implement session tokens for API calls

### Privacy

- Always respect visibility settings
- Round coordinates based on visibility mode
- Never expose exact locations publicly
- Implement rate limiting

### Real-time Updates

- Use WebSocket for live presence and broadcasts
- TODO: Implement Socket.io or similar
- Broadcast to subscribed clients on updates

### Validation

- Validate QR code expiry
- Validate geofence (if applicable)
- Check wallet claim limits
- Enforce rate limits
- Verify user hasn't already claimed

## Testing

```bash
# Test drops
curl http://localhost:3000/api/drops

# Test authorize claim
curl -X POST http://localhost:3000/api/claims/authorize \
  -H "Content-Type: application/json" \
  -d '{"dropId": "drop-1", "userAddress": "0x..."}'

# Test nearby users
curl 'http://localhost:3000/api/presence/nearby?lat=-1.2921&lng=36.8219&radius=1'

# Test broadcasts
curl http://localhost:3000/api/broadcasts?eventId=event-1
```
