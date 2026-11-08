# Background Images — Dark + Light Mode (Spartan Arena)

> Purpose: app ke background me ek **halka gaming texture** ho jo theme ke saath match kare,
> par UI (cards, text, buttons) ke upar se na chade. Opacity 10%–50% ke range me screen-wise
> control karenge.

---

## 1. Hamara theme (prompt isi ke hisaab se hai)

| Token | Dark mode | Light mode |
| --- | --- | --- |
| App base bg | `#050B14` (near-black navy) | `#F8FAFC` (near-white slate) |
| Card / surface | `#0B1526`, `#0C121E` | `#FFFFFF`, `#F1F5F9` |
| Border | `white/10` | `slate-200 #E2E8F0` |
| Accent 1 | Gold `#FFD000` / amber-400 | Same gold, thoda dark `#E6A700` |
| Accent 2 | Crest red `#C1121F`, deep red glow | Soft rose `#FDA4AF` |
| Text | `#FFFFFF` / `slate-300` | `#020617` / `slate-600` |
| Font vibe | Chakra Petch (gaming), Cinzel (spartan) | same |

**Design rule:** background = *ambiance*, logo/cards = *hero*. Isliye image me **center khali** ho,
sirf corners/edges pe light aur texture ho — data cards beech me aate hain.

---

## 2. Kaisa image suit karega (final decision)

### Dark mode — "Arena at night"
- Near-black navy base, edges pe **gold/amber rim light**, halke **red ember sparks**
- Thin diagonal light streaks / dust particles — esports stage jaisa
- Bada **clean dark center** (60–70% area empty)
- Contrast: bahut low. Koi character, gun, chehra, text nahi

### Light mode — "Daylight arena blueprint"
- `#F8FAFC` base, ulta-light grey **diagonal grid / blueprint lines**
- Ek patli **gold accent line** corner se (brand ke saath match)
- Soft blurred hex/geometry shapes corners me
- High-key, no heavy shadows, center bilkul saaf

### Kabhi mat karo
- Photo-realistic gamer setup / RGB keyboard photo → UI ke saath fight karta hai
- Busy pattern poore frame me → text padhna mushkil
- Game ka official artwork / Free Fire ka koi asset → **copyright risk**
- Neon purple/cyan gradient mesh (2019 wali "AI gradient" feel) → premium nahi lagta

---

## 3. Nano Banana prompts (copy-paste)

### 3.1 DARK — phone (9:16)

```
Vertical mobile app background, 9:16 portrait, esports arena ambience.
Base: near-black deep navy #050B14, smooth and clean.
Edges only: soft golden-amber rim light (#FFD000 at 30% strength) sweeping in from the
top-right and bottom-left corners, a thin diagonal light streak or two, and 6-10 tiny
red-orange ember particles (#C1121F) drifting near the corners.
Large clean empty dark area in the center 60% for UI cards.
Soft vignette at the edges, very low contrast, muted and premium, cinematic haze.
No text, no logo, no character, no face, no weapon, no brand, no watermark, no grain noise.
```

### 3.2 LIGHT — phone (9:16)

```
Vertical mobile app background, 9:16 portrait, daylight esports blueprint.
Base: near-white #F8FAFC, bright and airy.
Texture: ultra-subtle light-grey (#E2E8F0) diagonal grid lines fading out toward the center,
a thin warm gold (#FFD000) accent line curving in from the top-right corner, two or three
softly blurred pale-grey hexagonal shapes near the bottom-left.
Center 60% almost plain white with lots of negative space for UI cards.
High-key lighting, very low contrast, minimal, clean, premium.
No text, no logo, no character, no watermark, no strong shadows, no color noise.
```

### 3.3 Tablet / web (16:9) — same text, sirf pehli line badlo

```
Horizontal background, 16:9 landscape, esports arena ambience.  (baaki text same)
```

### 3.4 Seamless pattern version (repeat hoga, chhota file)

```
Seamless tileable dark esports pattern, 1024x1024, near-black navy #050B14 base,
faint diagonal gold (#FFD000) light streaks and thin grid lines, subtle red ember dots,
uniform brightness across the whole tile, no vignette, no center focus, no text, no objects.
```

### 3.5 Negative prompt (jahan option ho)

```
text, watermark, logo, letters, character, face, gun, weapon, hands, photo-realistic room,
RGB keyboard, busy pattern, high contrast, cluttered center, purple cyan gradient mesh,
harsh highlights, noise, grain, HDR, cartoon
```

---

## 4. Opacity strategy (10%–50%)

| Screen | Dark | Light | Kyun |
| --- | --- | --- | --- |
| Login / OTP | 50% | 45% | koi list nahi, brand feel chahiye |
| Home / Tournaments list | 18% | 33% | cards zyada, bg ko peeche rehna hai |
| Match detail sheet | 10% | 15% | sheet ka apna bg hota hai |
| Wallet | 15% | 25% | numbers padhne hain |
| Settings | 20% | 30% | text-heavy |
| Header/sticky bar ke peeche | 0% | 0% | waha blur + solid color |

Rule of thumb: **jitna text, utna kam opacity.** 50% sirf waha jaha screen pe bada khali area ho.

---

## 5. App me kaise lagayenge (ready code)

`Ambient.tsx` (already maujood hai) me image layer add karo:

```tsx
{/* Theme-aware bg image — screen prop se opacity aayega */}
<img
  src={isDark ? '/assets/backgrounds/bg_dark_ai.webp' : '/assets/backgrounds/bg_light_geometry.webp'}
  alt=""
  aria-hidden="true"
  className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
  style={{ opacity: isDark ? 0.18 : 0.32, filter: isDark ? 'saturate(0.9)' : 'none' }}
  draggable={false}
/>
```

Best practices:
- Image **next/image / preload** karo, warna pehli baar flicker hoga
- WebP/AVIF use karo (1080×1920 ≈ 25–300 KB) — PNG nahi
- `object-cover` + `fixed` (ya `position: fixed`) taaki scroll pe bg na hile
- Cards ke peeche `backdrop-blur-xl` rakho, image blur karne ki zarurat nahi padegi
- Light mode me image ka `contrast` thoda kam karo, warna grid lines text se ladengi

---

## 6a. Abstract free-license images (fallback ke liye)

| File | Source | License |
| --- | --- | --- |
| `bg_dark_neon.webp` | Pexels #36174639 (abstract neon streaks) | Pexels License — free commercial use, no attribution needed |
| `bg_light_geometry.webp` | Pexels #12977019 (white 3D geometry) | Pexels License |
| `bg_dark_ai.webp` | Nano-banana prompt 3.1 se generate (preview) | self-generated |

Path: `player-web/public/assets/backgrounds/` (+ finel demo copy). Character art ke liye section 6 dekho.

Note: pexels wali dark image thodi **busy** hai — usko 10–12% se zyada mat karo, warna text
ke saath fight karegi. AI-generated `bg_dark_ai` cleaner hai, default wahi rakho.

---

## 6b. Character / action artwork (bg me banda chahiye to)

Plain texture ki jagah **character doing action** bhi chalega — bas 3 rules follow karo:

1. **Character side ya bottom me ho**, center me nahi (center me cards aate hain)
2. **Opacity 15–25% max** (28%+ pe busy lagta hai)
3. Neeche **scrim gradient** + cards solid (`#0B1526`) — tab text 100% readable rehta hai

Comparison mockup (6 variants, real UI ke saath): `tmp_screens/bg_character_compare.png`

### Downloads (Pexels License — free commercial, attribution optional)

| File | Source | Vibe |
| --- | --- | --- |
| `bg_dark_warrior.webp` | Pexels #32200384 | cyberpunk holographic warrior, blue/violet |
| `bg_dark_samurai.webp` | Pexels #31971484 | cyberpunk samurai + neon sword, warm gold |
| `bg_dark_katana.webp` | Pexels #33161420 | warrior + katana, red backdrop |

### Character prompts (nano banana)

Dark mode:

```
Vertical 9:16 mobile app background, dark esports poster art.
Left third: a muscular esports athlete / spartan warrior in an explosive action pose
(jumping forward, one arm reaching out, dust and speed lines), rendered as a dark
silhouette with strong golden-amber rim light (#FFD000) on the edges and a faint red
glow (#C1121F) behind the shoulders.
Right two thirds: nearly empty deep navy #050B14 gradient background for UI cards.
Subtle diagonal light streaks and floating ember particles, soft vignette, very low
contrast overall, 20% brightness, cinematic haze.
No text, no logo, no watermark, no face details, no gore.
```

Light mode:

```
Vertical 9:16 mobile app background, clean daylight esports poster art.
Right third: a light grey / white stylised esports athlete silhouette in a dynamic
jumping action pose with a soft gold (#FFD000) rim light outline, minimal flat shading.
Left two thirds: plain #F8FAFC white space for UI cards, faint diagonal grid lines
fading out, two blurred pale-hex shapes.
High-key, low contrast, airy, premium, minimal.
No text, no logo, no watermark, no dark shadows.
```

---

## 7. Kahan se free (non-copyright) images milengi

| Site | License | Kya milega |
| --- | --- | --- |
| **pexels.com** | Pexels License — free commercial, no attribution | cyberpunk/anime costume art, gaming setups, neon characters |
| **pixabay.com** | Pixabay Content License — free commercial | illustrations, silhouette warriors, vector art |
| **unsplash.com** | Unsplash License — free commercial | moody arena / gamer photos |
| **opengameart.org** | CC0 / CC-BY filter lagao | game character art, sprites, fantasy warriors |
| **kenney.nl** | CC0 (public domain) | clean game UI + character packs |
| **craftpix.net/freebies** | Free section, license file ke saath | 2D characters, esports art |
| **itch.io → free game assets** | per-asset (CC0 dekho) | indie character art packs |
| **game-icons.net** | CC BY 3.0 | icons (badge, trophy, gear) |

### ⚠️ Copyright warning
- **Fan art safe nahi hota.** Pexels/Pixabay pe "Apex Legends", "Free Fire", "Valorant"
  character ke naam se jo art milta hai wo **studio ka IP** hai — app me daalna risky.
- Game ka official logo/character/skin screenshot **kabhi mat** use karo.
- Filter hamesha "Free for commercial use" + license page check karo.

---

## 8. Checklist (jab images aa jayein)

- [ ] Dark bg: center 60% khali, corners me gold rim light
- [ ] Light bg: center plain, grid bahut halka
- [ ] Dono ka aspect 1080×1920 (phone) aur 1920×1080 (tablet)
- [ ] Text/card ke saath 1 screenshot dark + 1 light me legibility check
- [ ] WebP convert + `<200 KB`
- [ ] `Ambient.tsx` me theme switch test (dark ↔ light)
