# Database schema

The backend uses MongoDB through Mongoose. Model files live in `server/src/models/`.
The schemas use explicit collection names and reference related documents by
ObjectId; authorization and reference integrity must still be enforced by the
service layer.

## Collections

- **users** — guest identity (`displayName`, `userType`, optional `avatar`,
  activity fields, and optional `expiresAt`). Guest expiration uses a TTL index
  on `expiresAt`; set this date according to the application's retention policy.
  Expiring a user removes only the user document, not documents that reference
  it, so retention must account for room and replay history.
- **rooms** — room code and name, host, member and join-request subdocuments,
  presenter, permissions, settings, status, and lifecycle dates. Membership
  roles are `host`, `presenter`, or `participant`; membership states are
  `waiting`, `accepted`, or `left`; connection states are `online` or
  `offline`. Drawing permission is stored per member in `canDraw`; presenter
  designation is separate and limited to the room's single `presenterId`.
  Pending join requests remain in `pendingRequests` until accepted or withdrawn.
- **boards** — one board per room, enforced by a unique `roomId` index. A board
  stores structured drawing elements, viewport, version, and `updatedAt`.
  Supported element types are `freehand`, `rectangle`, `circle`, `line`, `text`,
  and `eraser`. Freehand and eraser paths use flattened coordinate pairs;
  rectangle, circle, and line use `x`, `y`, `width`, and `height`.
- **boardevents** — replay events with room, optional board and required actor
  references, event type, payload, per-room sequence number, and timestamp. The unique
  `{ roomId, sequenceNumber }` index protects event ordering.

## Indexes and operational notes

- `users.expiresAt` has a TTL index with `expireAfterSeconds: 0`.
- `rooms.roomCode` is unique; `rooms.hostId` is indexed.
- `boards.roomId` is unique.
- `boardevents` has a unique `{ roomId, sequenceNumber }` index and a
  `{ roomId, timestamp }` index for replay queries.
- Unique indexes are enforced by MongoDB only after index creation. Ensure
  indexes are built during deployment and handle duplicate-key errors.
- Keep drawing events to completed meaningful actions, not every pointer
  movement. Board snapshots remain the source for current board state; the
  event collection supports replay.
- The TTL policy must be coordinated with room/event history retention to avoid
  dangling user references.