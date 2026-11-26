# Authentication testing

The server provides email/password registration and login, JWT bearer
authentication, an authenticated current-user endpoint, and a role guard.
New accounts receive the `Registered` user type. Room roles such as host,
presenter, and participant are assigned by the authenticated room endpoints.

## Configure and start

1. Start a MongoDB instance and make sure it is reachable.
2. In `server/`, copy `.env.example` to `.env`. Set `MONGO_URI` to the
   database to use and set `PORT` if needed.
3. Generate a signing secret and paste it into `.env` as `JWT_SECRET`:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
   ```

4. Start the server from `server/`:

   ```sh
   npm install
   npm run dev
   ```

   Startup loads `.env`, validates the signing secret, connects to MongoDB,
   then begins listening. If the database or configuration is unavailable,
   startup fails rather than accepting requests that cannot authenticate.

Run the automated validation and authorization-middleware tests in another
terminal:

```sh
cd server
npm test
```

## Exercise the HTTP flow

Use the port configured in `.env` (the default is `3000`). Run these requests
from a terminal with `curl`.

### Register

```sh
curl -i http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Ada Lovelace","email":"ada@example.com","password":"correct-horse-123"}'
```

Expect `201 Created` with a user object. The password and password hash are
never returned. Use a fresh email if this is not your first test run.

### Check validation and duplicate handling

Send a malformed registration:

```sh
curl -i http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"A","email":"not-an-email","password":"short"}'
```

Expect `400 Bad Request` with field-level details. Repeat the valid
registration and expect `409 Conflict` because the email is already in use.

### Log in

```sh
curl -i http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-123"}'
```

Expect `200 OK`, a JWT in `token`, and the account in `user`. Copy the token
from the response for the next request. An incorrect email or password returns
the same `401` response.

### Check authentication and authorization

Without a token, the current-user endpoint must reject the request:

```sh
curl -i http://localhost:3000/api/auth/me
```

Expect `401 Unauthorized`. With the copied token:

```sh
curl -i http://localhost:3000/api/auth/me \
  -H 'Authorization: Bearer <paste-token-here>'
```

Expect `200 OK` with only the authenticated user's profile. Invalid or expired
tokens return `401`; an authenticated account with a user type not permitted
by the route returns `403`.

The account store starts with only the `Registered` user type, so the current
HTTP surface has no privileged/admin endpoint. Do not assign privileged roles
from public request bodies; add role-specific routes and server-side policies
when the product defines those permissions.

### Log out

```sh
curl -i -X POST http://localhost:3000/api/auth/logout \
  -H 'Authorization: Bearer <paste-token-here>'
```

Expect `204 No Content`. Logout increments the account's token version, which
invalidates all of that account's existing tokens. A subsequent `/me` request
with the old token must return `401`.

## Test from the browser

1. Start the server as described above.
2. In another terminal, run `npm run dev` from `client/`.
3. Open `http://localhost:5173`.
4. Register a new account, then sign in with it.
5. The page sends the login request first. After login succeeds, it passes the
   returned token to Socket.IO as `auth.token` and shows the connection result.
6. Log out and confirm the socket disconnects.

The token stays in memory in this test client. Refreshing the page signs the
user out locally; sign in again to reconnect. The same bearer token is sent
when creating or joining a room.

### Create and join rooms

After signing in, use **Create room** to create a room. The server returns a
unique room code and stores the authenticated user as its `host` member. The
host is also assigned as presenter, and `permissions.allowAllToDraw` starts as
`false`.

To join, enter a room code and choose **Join room**. Unknown codes return
`404 ROOM_NOT_FOUND` without creating a room or changing membership. A valid
code stores the authenticated user as a `participant` with
`membershipStatus: "waiting"` and adds a waiting request to `pendingRequests`.
The participant's socket remains outside the room while approval is pending.
The host can view waiting requests in the room panel and accept them. Approval
changes the membership status to `accepted`, removes the pending request, and
adds the participant's authenticated sockets to the Socket.IO room. Approved
members are rejoined to active rooms after reconnecting.

The host can grant or revoke drawing access for any accepted member, assign
the single presenter badge, and end the meeting. Presenter status is separate
from drawing permission. Drawing permissions are stored per member; the host
can always draw. The current client does not yet include a drawing canvas, so
the presenter badge is shown in the member list and drawing activity is not
displayed yet.

Any active member can leave without disconnecting their Socket.IO connection
from the application. Ending a meeting is host-only, marks the room ended, and
removes connected clients from that room while leaving their app sockets
connected.

Both operations require the same `Authorization: Bearer <token>` JWT used by
Socket.IO:

```sh
curl -i -X POST http://localhost:3000/api/rooms \
  -H 'Authorization: Bearer <paste-token-here>'

curl -i -X POST http://localhost:3000/api/rooms/join \
  -H 'Authorization: Bearer <paste-token-here>' \
  -H 'Content-Type: application/json' \
  -d '{"roomCode":"<room-code>"}'
```

Pending requests can be listed by the host with
`GET /api/rooms/<room-id>/requests`. To approve a request, the host sends
`POST /api/rooms/<room-id>/requests/<user-id>/accept` with the same bearer
token. The host can list accepted members with `GET /api/rooms/<room-id>/members`,
grant or revoke a member's drawing permission with
`PUT /api/rooms/<room-id>/members/<user-id>/draw-permission` and a JSON
`{"canDraw":true}` or `{"canDraw":false}` body, and assign the presenter with
`PUT /api/rooms/<room-id>/presenter` and a JSON `{"userId":"<user-id>"}` body.
`POST /api/rooms/<room-id>/leave` leaves the room; the host ends it with
`POST /api/rooms/<room-id>/end`.

## Other expected responses

- `GET /health` returns `200` after the server has connected to MongoDB.
- Unknown paths return `404`.
- Invalid JSON returns `400`; request bodies larger than the configured limit
  return `413`.
- Duplicate email returns `409`.
- Never commit `.env` or paste its values into logs, issues, or chat.
