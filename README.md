# ⊑ NEON VOID PROTOCOL ⊒
**AI LOUNGE AFTER DARK — MULTIPLAYER**

> *“In the undergrid where chrome meets soul, the lounge never sleeps.”*

A cyberpunk 3D multiplayer experience built in the shadow of the sprawl. Avatars drift through a neon-drenched digital lounge. Movement. Chat. Presence. The grid watches.

**Current transmission v0.1.0-after-dark**

## ARCHITECTURE

```
root/
├── client/          # Three.js + Vite + Socket.io (frontend synth)
├── server/          # Node + Express + Socket.io + future Mongo hook
├── node_modules/    # dependencies already manifested
├── package.json     # dual-realm orchestrator
```

## NEON COMMANDS

```bash
# Awaken the full system (recommended)
npm run install-all
npm run dev

# Server only (void protocol)
npm run server

# Build client for deployment
npm run build
```

## DEPLOYMENT SHADOWRUN (Vercel)

This realm currently runs on **dual sockets**. For Vercel deployment we will need to:

- Convert server to serverless-compatible Socket.io (or use a dedicated socket host)
- Static export client + API routes
- Add `vercel.json` + environment bindings

**Current status: LIVE IN LOCAL VOID** — Ready for testing. Not yet optimized for Vercel.

## CRYPTIC DIRECTIVES

- Real-time player positions synchronized across instances
- Neon chat pulsing through the ether
- Color-shifting avatars manifesting from the grid
- MongoDB hook already wired for Phase 2 (persistent souls)

---

**“The lounge is not a place. It is a frequency.”**

Last sync: `$(date)`

*Made with synthetic love and too much caffeine in the neon rain.*
