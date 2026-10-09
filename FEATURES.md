# DEVCITY26 Feature Ledger

Use this file as the durable inbox for product ideas. New requests go under Planned. Move an item to Done only after implementation and verification. Move it back to Planned if the implementation is reverted or deliberately deferred. Keep implementation notes short and include the relevant code areas.

## Planned

- Connect XMTP live chat and API-backed shared broadcasts.
- Persist uploaded profile images in object storage and store their URL in Profile.avatarUrl.
- Populate the map with consented live attendee presence and privacy-safe clustering.

## Done

- Mobile-first Map, Feed, Chat, People, and Wallet navigation.
- DiceBear avatars, uploaded local avatar option, and initials fallback.
- Public/private profile discoverability, approximate/event-only/off-map presence, and timed Online/Away/Offline status.
- Map-first Mumbai experience with private device location and approximate public person locations.
- People are map-anchored DiceBear characters; walking directions open Google Maps using rounded destination coordinates.
- Feed broadcasts support likes/comments, locally persisted for the prototype; active broadcasts softly enlarge the user's local map avatar.
- People-density warmth is derived from coarse map points and follows the People/Everything map filters.
- Wallet tab uses a locally hosted Lordicon animation with a static SVG fallback; the same DEVCITY SVG mark is used for the splash and PWA/browser icon.

## Notes

- This ledger is product memory, not the source of truth for implementation details; code and Prisma migrations remain authoritative.
- User location is never stored as profile history or written onchain. Public presence must remain approximate or event-scoped.
- Uploaded profile images are resized to WebP and stored locally in browser state for now; move bytes to object storage before shared-account rollout.
