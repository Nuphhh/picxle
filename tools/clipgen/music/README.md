# Music for the clips

Drop a track in this folder and pass its name:

```bash
node makeclip.js --puzzle 2026-07-16 --music curious-loop.mp3
```

It is looped if shorter than the clip, trimmed to length, faded in, and faded out
under the end card. GIFs have no audio track, so this only affects the mp4.

## Read this before you use anything

**"Copyright free" almost never means "no conditions."** Nearly everything sold or
given away as *royalty-free* still comes with a licence. Getting this wrong on a
monetised or business account is the same class of mistake as posting a CC-BY photo
without crediting the photographer.

Ranked by how few strings are attached:

| Source | Cost | Attribution | Notes |
|---|---|---|---|
| **YouTube Audio Library** (in YT Studio) | Free | Filter for "no attribution required" | Safest for YouTube — cannot be Content ID claimed against you |
| **Pixabay Music** | Free | None | Permissive, commercial use fine. Best cross-platform pick |
| **Uppbeat** | Free tier | Credit required on the free tier | Good quality, clear terms |
| **Incompetech** (Kevin MacLeod) | Free | **CC-BY — you MUST credit** | Huge library; crediting is not optional |
| **Epidemic Sound / Artlist** | ~£10–15/mo | None | Removes all doubt if the channel grows |

Even genuinely free music can attract a **Content ID claim** — usually a false one you
can dispute, but a nuisance. The top two sources avoid it.

If a track needs crediting, put it in the video description alongside the image
credit. `makeclip.js` does not add music credits to the caption automatically,
because the licence terms differ per track and guessing them would be worse than
useless.

## What suits the format

Light, curious, building — with something landing around the 11s mark where the
image resolves. Search: *"quirky puzzle"*, *"playful curiosity"*, *"light tension
build"*. Avoid vocals: they fight the on-screen text.

## Should you embed it at all?

For **YouTube Shorts** and **X**: yes, embed. Neither rewards native audio.

For **TikTok and Reels**: embedding costs you reach. Picking a trending sound in-app
gets an algorithmic lift that an embedded track does not, and a video carrying its
own audio is treated as "original sound." If you want a bed anyway, both apps let you
add an in-app sound *on top* and balance the two — so post the embedded version and
mix a trending sound over it in the editor. That way you keep the lift.
