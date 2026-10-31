# Sound credits

| Files | Source | License |
| --- | --- | --- |
| `music`, `music-draw` | Composed and rendered for Quick Bingo | Project's own |
| `coin-*`, `card-*`, `swipe-*`, `fan`, `deal`, `tick`, `star-*`, `end`, `jackpot`, `near` | Sound-designed for Quick Bingo, rendered by `../tools/make_sfx.py` | Project's own |
| `cheer`, `cheer-small` | Gregor Quendel, [Free Crowd Cheering Sounds](https://opengameart.org/content/free-crowd-cheering-sounds) (tracks 04 and 05, trimmed to 2.8 s and 2.1 s) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/): credit "Gregor Quendel" |
| `applause` | BigSoundBank, [Applause from 40 people 7](https://bigsoundbank.com/applause-from-40-people-7-s3523.html) (trimmed) | CC0 |

The effects are mono (Vorbis q2 / AAC 56 kbps) to stay small. Every clip ships as `.ogg` and `.m4a`; the game loads the one the browser plays. A missing or
unplayable clip falls back to the synthesized sound in `../sfx.ts`.

The ball sounds (blower, latch, swish, pop, landing, number chime) are not recordings: they are
written into small buffers by `makeKit` in `../sfx.ts` when sound starts.
