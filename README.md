# ♪ StellarMusily

**Learn an instrument. Level up every day.**

Tempo is an open-source, Udemy-style marketplace for music courses, built on Stellar.
Instructors sell courses, learners buy them and progress through game-style levels with
real-time pitch feedback, and Soroban smart contracts handle payments, refunds and certificates.

## Why Stellar

| Problem on today's course platforms | StellarMusily on Stellar |
|---|---|
| Instructors wait 30+ days for payouts and lose a lot to fees | Instructor, co-authors and platform are paid in one transaction after the refund window |
| Cross-border payments are hard for African instructors and learners | USDC on Stellar, with local on/off-ramps through anchors |
| Course certificates are PDFs anyone can fake | Non-transferable, verifiable on-chain certificates |
| Refund rules are opaque | Refund rules are enforced by a public contract |

## How it works

```
Learner ──buy (USDC)──▶ course_payment ──escrow 7 days──▶ release ─┬─▶ platform fee
   │                         ▲                                      ├─▶ co-authors (bps splits)
   │ practice (mic)          │ report_progress                      └─▶ instructor (remainder)
   ▼                         │
Frontend ──/practice──▶ Backend (XP, streaks, badges, leaderboard)
                             │ course completed
                             ▼
                        certificate ──▶ verify(owner, course_id)
```

**Game loop:** each lesson is a level on a course map. Pass a level's challenge (for example, hold the
note `E2` in tune for 3 seconds) to unlock the next. Earn XP, keep a daily 🔥 streak, collect badges and
climb the weekly leaderboard. Finishing every level mints a certificate.

**Refund rule:** full refund within 7 days if the learner hasn't passed level 2. After that, anyone can
call `release` to settle the payment.

## Repo layout

```
contracts/          Soroban smart contracts (Rust)
  course_payment/   course listing, purchase escrow, refunds, revenue splits
  certificate/      non-transferable completion certificates
backend/            Node.js API: courses, practice sessions, gamification, on-chain oracle
frontend/           Next.js app: catalog, course map, mic pitch challenge, Freighter wallet
scripts/            testnet deployment
docs/               starter issues and roadmap
```

## Quick start

**Requirements:** Rust + `wasm32v1-none` target, [Stellar CLI](https://developers.stellar.org/docs/tools/cli), Node 20+, and the [Freighter](https://www.freighter.app/) wallet.

```bash
# 1. Contracts
cd contracts
cargo test

# 2. Backend (runs in dry-run mode without Stellar keys)
cd ../backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000

# 3. Frontend (dev mode unlocks all courses without payment)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

### Deploy to testnet

```bash
./scripts/deploy-testnet.sh
```

The script builds and deploys both contracts, initializes them, and prints the contract IDs to copy
into `backend/.env` and `frontend/.env.local`.

## Status

Early MVP. Working today:

- [x] `course_payment` contract with escrow, refunds and splits (7 tests)
- [x] `certificate` contract (3 tests)
- [x] API with XP, levels, streaks, badges, lesson unlocking and leaderboard (8 tests)
- [x] Course map UI with live mic tuner and Freighter purchase flow

See [docs/STARTER_ISSUES.md](docs/STARTER_ISSUES.md) for what's next. Contributions welcome!

## License

MIT
