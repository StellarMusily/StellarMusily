# Starter issues

Copy these into GitHub issues. Labels in brackets.

## Contracts
1. **Emit events for purchase, refund, release and certificate issue** [good first issue, contracts]
   Lets indexers and the frontend track activity without polling.
2. **Extend storage TTL for courses, purchases and certificates** [contracts]
   Persistent entries expire without `extend_ttl`; add bumps on read/write.
3. **Batch `release` for many learners in one call** [contracts]
4. **Allow admin to change platform fee and oracle** [good first issue, contracts]
5. **Certificate checks `course_payment.has_access` cross-contract before issuing** [contracts]
6. **Instructor-set refund window per course (min 3, max 14 days)** [contracts]

## Backend
7. **Replace in-memory store with Postgres using `db/schema.sql`** [backend]
8. **Verify `has_access` on-chain before accepting `/practice`** [good first issue, backend]
9. **Retry queue for failed on-chain calls** [backend]
10. **Weekly leaderboard reset job (Monday 00:00 UTC)** [good first issue, backend]
11. **Wallet sign-in (SEP-10) so practice can't be logged for someone else's address** [backend, security]
12. **Auto-call `release` for purchases past the refund window** [backend]

## Frontend
13. **Rhythm challenge: tap along to a metronome, score timing accuracy** [frontend, game]
14. **Chord detection challenge (chromagram)** [frontend, game, hard]
15. **Badge collection page with locked/unlocked art** [good first issue, frontend]
16. **Instructor dashboard: create course, set splits, see sales** [frontend]
17. **Certificate verification page: paste address, see certificates** [good first issue, frontend]
18. **Lesson video player above each challenge** [frontend]
19. **Mobile layout polish for the course map** [good first issue, frontend]

## Content and community
20. **Translate UI into Yoruba, Igbo, Hausa and French** [i18n, good first issue]
21. **Add a "Talking Drum 101" demo course** [content]
22. **Pay with local currency through a Stellar anchor (SEP-24)** [payments]

## Docs
23. **Architecture diagram and contract call sequence** [docs, good first issue]
24. **Video walkthrough of local setup** [docs]
