# 🔥 Dapur Bara — Wok Rush

[![competition](https://make.fun/api/competitions/best-cooking-game-20261125-0137/competition.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/api/competitions/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/api/competitions/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

**[▶ Play the entry — make.fun bounty page](https://make.fun/bounty/best-cooking-game-20261125-0137)**

An original timed cooking game for the make.fun contest **"Make the best cooking game"** ($250 pot, top 10 share it). Built in one session, from scratch, in plain HTML/CSS/JS — no libraries, no network requests, no copied art, names, or music.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server) and click **MULAI SHIFT**.

1. **Read the order board** (left) — each card shows the dish, its ingredients, and a patience bar. Click a card to target it.
2. **Grab ingredients** from the counter (bottom) — click a bin, or press **1–8**.
3. **Cook at the right station** — 🔪 Talenan (chop), 🍳 Wok (fry), ♨️ Grill (barbecue), 🍲 Panci (boil). Keys **Z X C V**. Each station shows a live progress bar.
4. **Take food off in time** — a finished dish burns in 6 seconds. Click a ✅ station to pick it up, then click the plate to add it.
5. **Serve** when the plate matches the target order exactly — fast serves earn bigger tips.

## Systems (all visible in the HUD)

- **Order queue** — up to 4 live orders, each with its own patience timer and tip value that shrinks as patience runs out.
- **4 cooking stations** — progress bars, done ✅ state, and a burn 🔥 state if food is left too long.
- **Ingredient stock** — 8 bins with live counts; restock costs 5 coins (+4 each). Running out blocks cooking.
- **Money, tips & combo** — coins per serve, tip scaled by remaining patience, combo multiplier up to ×5 for on-time streaks.
- **Levels & shifts** — 150-second shifts with a serve quota; levelling up unlocks new recipes (6 total) and speeds up orders.
- **Hearts & fail state** — an expired order costs a heart and resets the combo; lose all 3 and the shift fails.
- **Pause / restart / mute** — `P`, `R`, `M`. Synthesized WebAudio sounds (sizzle, chop, ding, coins, alarm) — no audio files.
- **Win/lose flow** — end-of-shift results with stars, coins earned, best combo, and a next-shift button.

## Recipes

| Dish | Ingredients | Station path |
|---|---|---|
| Nasi Goreng | Nasi · Telur · Cabai | Wok + Wok + Talenan |
| Mie Goreng | Mie · Telur · Sayur | Wok + Wok + Talenan |
| Sate Ayam | Ayam · Cabai | Grill + Talenan |
| Ayam Geprek | Ayam · Cabai · Nasi | Grill + Talenan + Wok |
| Soto Ayam | Ayam · Teh · Sayur | Grill + Panci + Talenan |
| Es Teh Manis | Teh · Es | Panci + langsung ke piring |

## Repo layout

- `main.ts` — entry program (Node 22): copies `game/` + `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`.
- `game/` — the playable game: `index.html`, `style.css`, `game.js` (pure CSS art + emoji glyphs + WebAudio, zero network).
- `screenshots/` — 4 real renders of the game's own code in desktop Chrome.
- `vendor/makefun-game.ts` — kit copy (added after kit go-ahead; see `vendor/NOT-KIT-YET.txt`).

## License

MIT — see [LICENSE](LICENSE).
