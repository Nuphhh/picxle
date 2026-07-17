# Picxle reveal-clip generator

Turns one puzzle image into a ready-to-post vertical MP4: the picture sharpening
stage by stage, a "pause if you know it" beat, the reveal, and a branded end card.

```bash
cd tools/clipgen
npm install          # once — pulls a self-contained ffmpeg binary, no system install

node makeclip.js \
  --image "https://picxle.vercel.app/puzzles/eggplant.jpg" \
  --answer "Eggplant" \
  --category "Food" \
  --credit "Picxle original (AI-generated), CC0" \
  --date 2026-07-13
```

Writes `out/<date>-<slug>.mp4` (1080x1920, H.264, silent, ~14s) and a matching
`.txt` caption.

| flag | |
|---|---|
| `--image` | local path **or** URL (required) |
| `--answer` | used for the filename and the caption — **never drawn on the video** (required) |
| `--category` | shown on the hook frame, e.g. `Landmarks` |
| `--credit` | attribution line for the caption — **required for CC-BY images** |
| `--date` | defaults to today; used for the output filename |
| `--music <file>` | mix a track from `music/` into the mp4 (looped, trimmed, faded). See `music/README.md` |
| `--music-credit "..."` | attribution line for the caption — **required for CC-BY tracks** (most "free" music) |
| `--music-start <sec>` | skip into the track — for one that opens with a quiet intro (measure with `volumedetect`) |
| `--fast` | skip the browser and pixelate with sharp (see below) |

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

## The answer is deliberately not on the video

Platforms often lift a late frame as the feed thumbnail, which would spoil the
puzzle before anyone taps — and leaving it unsaid is what makes people comment
their guess. The first frame is the blockiest stage, so the default cover is safe.
The answer goes in the generated caption.

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
