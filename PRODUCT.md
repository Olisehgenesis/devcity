# DEVCITY26 Product Brief

> A living city where people, places, and events have their own tokens.

## Product

DEVCITY26 is a mobile-first social city. People arrive with an identity, see what is happening nearby, and use tokens to take part. The city map is the home screen; the social layer makes it feel active, immediate, and personal.

**Product promise:** Open the city. Find your people. Claim something worth sharing.

## Audience and first market

Phase 1 is for event organizers and attendees, starting with a real in-person community event. Organizers seed the city with drops and places; attendees discover them, claim tokens, and tip one another. This gives the product a real crowd before expanding to open-ended creator use.

## Product principles

- **The city is the interface.** Map-first discovery, not a crypto dashboard.
- **Social before financial.** Tokens are things people give, claim, and use together. Trading is not the initial pitch.
- **Fast, familiar onboarding.** Passkey-first smart wallet, with wallet details kept out of the everyday flow.
- **Privacy by default.** Public presence is approximate or event-scoped. Exact coordinates are never public or written onchain.
- **Make the next action obvious.** Find a drop, understand eligibility, claim, and return to the city.

## Snapchat-inspired interaction direction

Borrow the qualities that make Snapchat feel immediate: mobile-first composition, lightweight identity, ephemeral presence, expressive avatars, friend activity, and quick actions. DEVCITY keeps its own visual language and leads with a living map rather than a camera. Event moments and nearby activity can feel temporary; economic records and token ownership remain durable.

## Core loop

**Enter → Explore → Discover → Claim → Give → Tip**

1. A person joins with a passkey or supported wallet.
2. They choose a username and avatar, then enter an event city.
3. The map surfaces people, places, and active drops.
4. A QR code or location check makes a drop eligible.
5. They claim with a sponsored transaction and see the result immediately.
6. They can share or tip tokens to another person.

## Phase 1 scope

### Build now

- Next.js responsive web app, installable PWA foundation
- Base Sepolia as the first chain environment; keep chain configuration isolated
- Map-first city home with seeded demo data for people, places, events, and drops
- Event-scoped profiles: username, avatar, wallet address, and visibility preference
- Token creation with a fixed maximum supply and token icon
- QR drops first, followed by geofence-based eligibility
- Claim eligibility and claim status UI; gas-sponsored path behind a service boundary
- Basic token detail and tipping interaction
- Mobile bottom navigation and a quick, social discovery surface

### Defer

- Mainnet token deployment until contract review and security checks
- Open token markets, swaps, and liquidity
- Quests, scheduled drips, merchant payments, and multi-chain
- Realtime exact user tracking and public exact location
- Full 3D city and 3D avatars

## Base and wallet decisions

- **Chain:** Base; Base Sepolia for development and the first pilot.
- **Wallet UX:** Passkey-first smart account through a maintained account SDK. Keep account creation, bundler, and paymaster implementation behind adapters so providers can change.
- **External wallets:** Add as a compatible path, but do not make WalletConnect a Phase 1 dependency.
- **Gas sponsorship:** Sponsored claims with per-wallet and per-drop budget limits. Testnet sponsorship is not evidence of production economics.
- **Contracts:** Token factory with immutable maximum supply; drop claims use expiring signed authorization and strict claim caps. Use audited libraries and get an independent audit before mainnet.

## Trust, safety, and privacy

- Never expose exact attendee coordinates. Use event-only or approximate visibility by default.
- Keep location checks offchain. The backend validates QR expiry, geofence, wallet limits, rate limits, and drop budget before signing a claim authorization.
- QR payloads rotate or expire; enforce one-claim rules and per-drop maximums onchain.
- Do not store unnecessary location history. Do not put location or biometric data onchain.
- Limit token spam with creation limits, symbol checks, reporting, and clear creator identity.
- Avoid investment promises. Markets require separate legal, security, and anti-abuse review.

## Experience direction

- Thumb-friendly, full-height mobile layouts with the map as the primary canvas.
- Strong, recognizable avatar and activity treatments; small temporary moments can animate, while persistent token and claim states stay clear.
- Social discovery should feel lively, but location privacy should be legible and user-controlled.
- Keep monetary and token values factual. Never imply a token will appreciate.
- Desktop adapts into a wider city view with a compact activity rail rather than stretching a phone layout.

## Success measures for the first pilot

- Scan-to-claim conversion
- Median time from opening a drop to successful claim
- First-time wallet completion rate
- Claim failure and duplicate-claim rates
- Share of claimants who tip another attendee
- Organizer willingness to run a second event

## Pilot exit criteria

Run one real event on Base Sepolia. Aim for a median claim time below 15 seconds, near-zero avoidable claim failures, understandable eligibility feedback, and no public exact-location exposure. Test QR sharing, GPS spoofing, duplicate devices, poor connectivity, and first-time smart-account deployment before expanding scope.

## Open implementation decisions

- Select and prove the passkey smart-account SDK, bundler, and paymaster on Base Sepolia.
- Choose the first pilot event, event organizer, and expected attendee count.
- Decide whether drops are pre-funded or minted on claim; prefer pre-funded for the pilot unless token issuance constraints require otherwise.
- Confirm backend and database hosting, including PostGIS support, before implementing location verification.
