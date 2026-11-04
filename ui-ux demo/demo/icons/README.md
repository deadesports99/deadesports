# Icons — "Telegram jaisa" bold duotone set

App ke saare icons ek hi family me, EGA theme (#0B1526 / #00C2FF / #FFD000) ke saath.
Lucide jaisa hi API — import ka naam badalne ki zarurat nahi, sirf path.

## Files

| file | kya hai |
|---|---|
| **`tg-icons.tsx`** | **Ye use karo.** Saare 47 icons + `Chrome` (Google G) + `ModeIcon` (solo/duo/squad/cs) React components me. |
| `svg/` | 47 icon masters + `google-g.svg`, `gmail.svg` — Figma / Canva / Illustrator me import karne ke liye (SVG import Canva Pro me chalta hai). |
| `preview.html` / `preview.png` | Dark + light sheet: har icon, real app sizes (10–24px), bottom bar aur mode chips ke andar. |
| `build.py` | Generator. Icon shape badalna ho to yahin edit karke `python build.py` chalao — svg, tsx, preview sab dobara ban jate hain. |

## Use kaise kare

```tsx
// pehle
import { Trophy, Wallet, Sun, Moon } from 'lucide-react';
// ab
import { Trophy, Wallet, Sun, Moon } from './icons/tg-icons';

<Trophy className="h-4 w-4 text-amber-400" />
```

Path har file ke hisaab se: `demo/` me `./icons/tg-icons`, andar ke folders (home, login, otp, WalletScreen, profile and settings) me `../icons/tg-icons`.
`lucide-react` ki dependency hata sakte ho — in icons ke liye zarurat nahi.

Mode chips ek hi entry point se:

```tsx
import { ModeIcon } from '../icons/tg-icons';

<ModeIcon mode="squad" size={14} className="text-[#FFD000]" />
// mode: 'solo' | 'duo' | 'squad' | 'cs'
```

## Style rules (naya icon add karte waqt inhi ko follow karo)

- 24×24 grid, safe area 2.2 → 21.8 (kuch bhi bahar mat niklo)
- stroke **2.2** (chhote size pe bhi tikta hai), round caps + round joins
- **duotone**: main shape `fill="currentColor" fill-opacity=".22"`, detail solid `fill="currentColor"`
- rang kabhi hard-code mat karo — sirf `currentColor`, warna dark/light theme tut jayega
- detail negative space se banao, extra patli lines se nahi
- **14px se chhota mat use karo** mode/nav icons ke liye (10px pe sirf simple shapes: Check, X, Plus)

## Sizes jo app me already use ho rahe hain

`h-4 w-4` (16) sabse zyada, `h-3.5 w-3.5` (14), `h-3 w-3` (12), `h-2.5 w-2.5` (10).
Sab icons 14–16px pe test kiye hue hain; 24–28px pe hero/empty states me acche lagte hain.

## Naya icon add karna

1. `build.py` kholo, `add("Naam", f'''...''')` wala block copy karke shape likho (`{D}` = duotone plate, `{S}` = solid detail).
2. `python build.py`
3. `preview.png` dekh lo, phir `tg-icons.tsx` me `Naam` import kar lo.
