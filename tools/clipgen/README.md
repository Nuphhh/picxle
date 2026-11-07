# Picxle reveal-clip generator

Turns one puzzle image into a ready-to-post vertical MP4. **The TikTok default:**
frame 0 already shows the puzzle (no intro), it plays a few sharpen stages, and it
**stops on the last pixelated stage** with an "Answer in the comments" prompt — no
full reveal, no logo card. Output is **silent** so you add sound natively in TikTok
(which gets a trending-audio boost an embedded track does not).

Why: the posts were getting 5–10 views — a watch-time/hook problem. A blank opening
loses people in the first second, and a full reveal + end card is dead air exactly
where TikTok measures completion. Stopping short pushes people into the comments.

```bash
cd tools/clipgen
npm install          # once — pulls a self-contained ffmpeg binary, no system install

node makeclip.js --puzzle 2026-07-25          # silent, no reveal, "answer in the comments"
```

Writes `out/<date>-<slug>-<variant>.mp4` (1080x1920, H.264 high@4.0, ~11s) and a
matching `.txt` caption. Every render is checked before it's accepted (see below).

| flag | |
|---|---|
| `--puzzle <date>` | pull that day's puzzle from the DB (image, category, credit). Default: yesterday |
| `--image` / `--answer` / `--category` / `--credit` / `--date` | override any field by hand |
| `--reveal` | full version: pause + reveal + end card (~16s). Default is no reveal |
| `--variant native` | **no baked text at all** — just the image reveal. Add text/sound in TikTok. For A/B tests |
| `--music <file>` | bake a track from `music/` (looped, trimmed, faded, **loudnorm'd to −14 LUFS**). Default silent |
| `--music-credit "..."` | caption attribution — **required for CC-BY tracks** (most "free" music) |
| `--music-start <sec>` | skip into a track with a quiet intro |
| `--silent` | force no audio even if `--music` is given |
| `--suffix <tag>` | append `-<tag>` to the filename so two cuts of one puzzle coexist — e.g. a silent TikTok cut and a `--suffix music` cut for YT/IG/FB — instead of overwriting |
| `--gif` | also emit a square looping GIF (full reveal — the loop is the second look) |
| `--fast` | skip the browser and pixelate with sharp (see below) |

## Posting to Buffer (YouTube + Instagram + Facebook)

`queue-to-buffer.mjs` schedules the **music cuts** (`*-standard-music.mp4`) to Buffer,
one day behind the puzzle date. It uploads each mp4 to a public Supabase Storage bucket
(Buffer pulls video by URL), books a post on each connected channel, and attaches the
**answer as the first comment on Instagram + Facebook** automatically. YouTube has no
comment API, so the script prints the exact comment text for you to paste + **pin** by
hand. TikTok is not handled here — it stays manual so a trending in-app sound can be added.

Each post gets a **YouTube title** (set via the API) and **description hashtags** (from the
caption). Buffer's API has **no field for YouTube's Studio Tags box**, so the script prints a
paste-ready tag list per video — including the *answer* keyword, which is safe because the
Tags box is hidden from viewers (the caption can't carry it without spoiling the puzzle).
Drop it into Studio → Settings → Tags after each Short publishes.

```bash
node queue-to-buffer.mjs                 # dry run — prints the plan, writes nothing
node queue-to-buffer.mjs --commit        # upload + schedule for real
node queue-to-buffer.mjs --commit --glob '2026-07-25-*-standard-music.mp4'   # one clip
```

| flag | |
|---|---|
| `--commit` | actually upload + schedule (default is a dry run) |
| `--time HH:MM` | post time in the **account timezone** (Europe/London; default 11:00 = the daily slot) |
| `--glob <pat>` | which clips to queue (default `*-standard-music.mp4`) |
| `--force` | re-book even if the ledger says it's already scheduled |

Needs `BUFFER_ACCESS_TOKEN` + the Supabase keys in `../../.env.local`. A ledger at
`out/.buffer-queued.json` records what's booked so re-runs never double-post. The first
`--commit` is the real test of the `createPost` call — **book one clip first**, check it
in Buffer's calendar (video, caption, first comment, date), then queue the rest.

## Acceptance checks (automatic, every render)

The render is rejected unless: **1080x1920 h264 ~30fps**; duration **10–20s**; frame 0
is not near-blank (the puzzle is on it — no intro); the final frame is the held CTA,
not a blank card; and audio is either absent (`--silent`) or **≥ −18 dB mean** when
baked in. A failure throws with the reason.

## Pixelation is the game's, exactly

By default the stages are rendered **through the game's own canvas** in headless
Chrome, using the real `RES_STEPS = [8, 12, 19, 29, 45]`, the same 440px
centre-cropped master, and the same hard-edged nearest-neighbour blow-up. Verified
**byte-identical** against pixels extracted from the live game (0/255 difference).

`--fast` uses sharp instead. It gets the block grid, crop and hard edges right, but
the block **colours** come out ~5% off (worst channel 91/255) because Chrome's
canvas downscaler uses a different filter than sharp's Lanczos. That is not subtle:
side by side, the sharp version loses the blue and near-black blocks entirely and
reads much warmer. Use it only if Chrome isn't available and you don't mind.

## The answer is never on the video

The default no longer even reveals the sharp image — it stops on the last pixelated
stage. The answer isn't drawn anywhere, and isn't in the caption either: it goes in
a **pinned comment**. That protects the feed thumbnail (frame 0 is the blockiest
stage) and makes people comment their guess, which is the engagement TikTok rewards.
Use `--reveal` only for other surfaces where a full reveal is wanted.

## Licensing — read this before posting

68 of the 247 puzzle images are **CC-BY: attribution is mandatory** when you post
them commercially. Pass `--credit` and it goes into the caption; the script warns if
you omit it. The 179 CC0/public-domain puzzles (including every AI-generated one)
need no attribution.

## Tweaking the format

Everything you'll want to iterate on — hook text, beat durations, colours, layout,
CTA — is in `config.js`. No logic there.

## Fonts

`fonts/BricolageGrotesque-ExtraBold.ttf` is instanced from the official variable
font at `wght=800` (Google publishes no static ExtraBold, and FreeType would
otherwise render the wordmark at Regular weight). Space Mono is stock.
