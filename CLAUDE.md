# Picxle — Project Context

## What this is
Picxle is a daily image-guessing game in the spirit of Wordle/Bandle.
The player sees a heavily pixelated image and guesses what it is. Each
wrong guess sharpens the image to a higher resolution. The signature
mechanic is **the image resolving as you fail.**

## Core rules
- Max **5 guesses** per puzzle (one puzzle per calendar day).
- Image starts very blocky and sharpens one step per wrong guess.
- Pixelation is done **client-side from a single high-res master image** —
  do NOT pre-render multiple resolution files. Draw the image to a small
  N×N canvas, then scale it up to display size with
  `imageSmoothingEnabled = false`. N increases per guess.
- Reference resolution steps used in the prototype: 8, 12, 19, 29, 45 px,
  then full resolution on solve/loss. Tune for difficulty.
- On win or loss: reveal the full image + answer, then show a
  Wordle-style emoji share grid.

## Builder context
- Solo builder, **still learning to code.** When writing code, explain
  *why* each part works, don't just dump it. Build in layers — one
  finishable, runnable milestone before adding the next.

## Tech stack (decided)
- **Editor:** VS Code (NOT Visual Studio).
- **Web framework:** Next.js (React).
- **Backend / DB / image storage / auth:** Supabase.
- **Hosting:** Vercel.
- **Mobile app (later):** wrap the finished web app with Capacitor for
  the App Store and Play Store — reuse the web code, don't rebuild native.

## Build phases (do them in order)
- **Phase 0 — Validate fun.** Put ~10–15 real images in the existing
  prototype and play it for a few days. Confirm the loop is fun and fair
  before building anything else.
- **Phase 1 — Single-player web app.** Next.js app, puzzles + answers in a
  local data file (NO database yet). Port the pixelation logic. Deploy to
  Vercel. Goal: learn React/Next without also fighting a backend.
- **Phase 2 — Add Supabase.** Move puzzles to a Postgres DB, store images
  in a Supabase bucket, validate guesses **server-side** so the answer
  never ships to the browser, add daily rotation.
- **Phase 3 — Streaks, stats, accounts** (Supabase auth).
- **Phase 4 — Mobile app** via Capacitor.

## Critical design constraints
- **Never ship the plaintext answer to the browser.** Check guesses
  server-side, or send only a hashed answer. (Deferred until Phase 2; fine
  to use a local file in Phase 1.)
- **Guess matching is the hard part.** Each puzzle needs an accepted-answers
  list (canonical name + aliases + common misspellings), plus either fuzzy
  matching or a constrained autocomplete. Don't rely on exact string match.

## Image sourcing & licensing rules
- **Answer-first, not image-first.** Start from a curated answer list,
  then fetch a clean licensed image for each subject.
- **Chosen lanes:** landmarks and/or pre-modern artworks (broad appeal,
  clean sourcing, crisp single-word answers). Avoid movie stills, album art,
  brand logos, and celebrity photos — copyrighted/trademarked, and app
  stores reject infringing IP.
- **Sources:** Wikimedia Commons (landmarks); Met (CC0), Rijksmuseum,
  Art Institute of Chicago, Smithsonian open-access APIs (artworks).
- **License filter — keep only:** CC0, public domain, CC-BY.
  **Exclude:** CC-NC (non-commercial), CC-SA/share-alike, ND/no-derivatives.
- **CC-BY requires attribution** even in a paid/ad-free product — show a
  credits screen.
- **Store license type + attribution string with every image** in the DB
  as an audit trail.
- Monetization (ad-free app, paid packs, subscription) is fine on CC0/PD/
  CC-BY content — you're selling the product/experience, not the public-
  domain images themselves.
- Note: CC0 does not waive trademark or publicity rights (non-issue for
  landmarks/old art, but watch logos and identifiable people).

## Current status
Working on Phase 3 — adding streaks, stats, and accounts via Supabase auth.
