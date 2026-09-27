# QR Tetris Battle

PLAYROOM game library, currently featuring Tetris with 1P solo and 2P battle. Phones are controllers only.

## Local

Node.js 22+. Run `npm install`, then `npm start`. Open http://localhost:3000 on the display computer. Choose 1P or 2P, create a room, scan each player's QR code with a different phone, then start on the display.

Phones and computer must be on the same LAN. The console detects a LAN address; adjust it in the lobby if the computer has several network adapters. Allow TCP port 3000 in Windows Firewall if required. A localhost QR code cannot be used by another device.

## Gameplay

Touch controls: left/right, up for clockwise rotation, down for soft drop, hard drop and hold. Hold is available once per locked piece. Movement buttons repeat while pressed. Each tetromino has a fixed bright color; gray unfilled outlines show the landing position. The controller attempts landscape orientation; unsupported browsers get a rotated landscape layout and a fullscreen button.

Combo counts consecutive pieces that clear lines and resets on a non-clearing lock. Combo 2x+ appears for 1.5 seconds. At 3x or higher, the combo count becomes attack units (3 units = 1 garbage row). A defending combo of 2x or higher cancels that many pending units first. On lock, remaining units become whole garbage rows, with fractional rows discarded. INCOMING displays pending units. A 3x attack therefore sends one row; a defending 2x cancels two units, preventing that row. Garbage arrives only after locking, never on hold. Winners receive confetti from both sides of their board.

Top out ends the round. A controller or host disconnect pauses play; reload the same page to reconnect, then resume from the console. Rooms expire after an hour without gameplay. Closing a room invalidates its links.

The pinned ISC-licensed `tetris-engine` implements movement, collision, rotation and line clearing. `game.js` adapts it for hold, ghost, combos, garbage and scoring. This version uses the engine's basic rotation and random pieces; it does not implement modern SRS, T-spins or seven-bag rules.

## Render

Push this project to a GitHub repository and create a Render Blueprint from `render.yaml`, or create a Node Web Service with `npm install --omit=dev` and `npm start`. The service binds `0.0.0.0` and `PORT`; HTTP and Socket.IO share the port. QR URLs use `RENDER_EXTERNAL_URL`, or optional `PUBLIC_URL` for a custom domain.

Use one instance: rooms are in memory and disappear on restart/deploy. Free services may sleep when idle, so open the console before inviting players. Horizontal scaling requires a shared room store and Socket.IO adapter. No account or payment configuration is included.

Run `npm test` for engine and live socket integration checks.
