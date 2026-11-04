"""
TG icon set — "Telegram jaisa" bold rounded duotone icons for the EGA app.

Style rules (har icon inhi rules ko follow karta hai):
  * 24x24 grid, safe area 2.2 -> 21.8
  * stroke 2.2, round caps + round joins  (bold = chhote size pe bhi dikhta hai)
  * main silhouette = duotone plate   fill="currentColor" fill-opacity=".22"
  * key detail      = solid fill      fill="currentColor"
  * currentColor => dark/light theme dono me sahi rang, koi baked colour nahi
  * detail negative space se, extra hairlines se nahi (10px pe bhi saaf)

Generates:
  *.svg           -> icon masters
  tg-icons.tsx    -> React components, lucide-react ke SAME names (1-line import swap)
  preview.html    -> dark + light preview (inline SVG so currentColor works)
"""
import pathlib, re

D = 'fill="currentColor" fill-opacity=".22"'   # duotone plate
S = 'fill="currentColor"'                      # solid accent
SW = 'stroke-width="2.6"'                      # thicker detail stroke (checks, slashes)

# name -> (inner svg body, extra props for the component)
ICONS: dict[str, str] = {}

def add(name, body):
    ICONS[name] = body.strip()

# ---------------------------------------------------------------- sun / moon
add("Sun", f'''
<circle cx="12" cy="12" r="4.1" {D}/>
<path d="M12 2.2v2.2M12 19.6v2.2M2.2 12h2.2M19.6 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>''')

add("Moon", f'''
<path d="M20.3 15.1A8.7 8.7 0 0 1 9 3.9 8.7 8.7 0 1 0 20.3 15.1Z" {D}/>
<path d="M16.2 4.2l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z" {S}/>''')

# ---------------------------------------------------------------- settings
add("Settings", f'''
<circle cx="12" cy="12" r="6.7" {D}/>
<circle cx="12" cy="12" r="2.9"/>
<path d="M12 2.3v2.6M12 19.1v2.6M2.3 12h2.6M19.1 12h2.6M5.1 5.1l1.85 1.85M17.05 17.05l1.85 1.85M18.9 5.1l-1.85 1.85M6.95 17.05 5.1 18.9"/>''')

add("Bell", f'''
<path d="M12 3.1a6.2 6.2 0 0 1 6.2 6.2v3.3l1.55 2.65a1.15 1.15 0 0 1-1 1.75H5.25a1.15 1.15 0 0 1-1-1.75L5.8 12.6V9.3A6.2 6.2 0 0 1 12 3.1Z" {D}/>
<path d="M9.4 20.1a2.7 2.7 0 0 0 5.2 0Z" {S}/>''')

# ---------------------------------------------------------------- chevrons / arrows
add("Check", f'<path d="M4.6 12.7 9.4 17.5 19.4 6.9" {SW}/>')
add("X", f'<path d="M6.3 6.3 17.7 17.7M17.7 6.3 6.3 17.7" {SW}/>')
add("Plus", '<path d="M12 4.9v14.2M4.9 12h14.2"/>')
add("ArrowLeft", '<path d="M20 12H4.8M10.8 5.8 4.6 12l6.2 6.2"/>')
add("ChevronRight", f'<path d="M9.2 5.4 15.8 12l-6.6 6.6" {SW}/>')
add("ArrowUpRight", '<path d="M6.6 17.4 17.4 6.6M8.7 6.6h8.7v8.7"/>')
add("ArrowDownLeft", '<path d="M17.4 6.6 6.6 17.4M15.3 17.4H6.6V8.7"/>')

# ---------------------------------------------------------------- money / status
add("Wallet", f'''
<rect x="2.7" y="6" width="18.6" height="13.6" rx="3.6" {D}/>
<path d="M2.7 10.4h18.6"/>
<rect x="14.6" y="13.1" width="4.9" height="3.4" rx="1.7"/>
<circle cx="17" cy="14.8" r="1.15" {S}/>''')

add("Trophy", f'''
<path d="M7 3.7h10v4.2a5 5 0 0 1-10 0V3.7Z" {D}/>
<path d="M7 5.4H4.9a2.1 2.1 0 0 0 0 4.2h.9M17 5.4h2.1a2.1 2.1 0 0 1 0 4.2h-.9M12 12.9v4.3"/>
<rect x="8.6" y="17.2" width="6.8" height="3" rx="1.4" {D}/>
''')

add("Award", f'''
<circle cx="12" cy="9.4" r="5.1" {D}/>
<circle cx="12" cy="9.4" r="2.1"/>
<path d="M9 13.4 7.5 21l4.5-2.55L16.5 21 15 13.4"/>''')

add("Zap", f'''
<path d="M13.1 2.8 6.2 12.5h4.4l-1.1 8.7 7.4-10.4h-4.4l.6-8Z" {D}/>
<path d="M13.1 2.8 9.9 7.6h4.4Z" {S} fill-opacity=".55"/>
''')

add("Sparkles", f'''
<path d="M11.4 3.4l1.7 4.2 4.2 1.7-4.2 1.7-1.7 4.2-1.7-4.2L5.5 9.3l4.2-1.7Z" {S}/>
<path d="M18.1 13.6l.95 2.3 2.3.95-2.3.95-.95 2.3-.95-2.3-2.3-.95 2.3-.95Z" {S}/>
<path d="M5.6 15.4l.65 1.6 1.6.65-1.6.65-.65 1.6-.65-1.6L3.35 17.65l1.6-.65Z" {S} fill-opacity=".55"/>''')

add("Crosshair", f'''
<circle cx="12" cy="12" r="6.7" {D}/>
<path d="M12 2.4v3.2M12 18.4v3.2M2.4 12h3.2M18.4 12h3.2"/>
<circle cx="12" cy="12" r="1.7" {S}/>''')

add("Flame", f'''
<path d="M12 2.9c4.3 4.7 7 7.3 7 11.4a7 7 0 0 1-14 0c0-4.1 2.7-6.7 7-11.4Z" {D}/>
<path d="M12 12.2c1.9 2.2 2.9 3.4 2.9 5.2a2.9 2.9 0 0 1-5.8 0c0-1.8 1-3 2.9-5.2Z" {S}/>''')

add("Shield", f'<path d="M12 2.6 20 5.7v6c0 4.9-3.4 8.5-8 10.1-4.6-1.6-8-5.2-8-10.1v-6L12 2.6Z" {D}/>')
add("ShieldCheck", f'''
<path d="M12 2.6 20 5.7v6c0 4.9-3.4 8.5-8 10.1-4.6-1.6-8-5.2-8-10.1v-6L12 2.6Z" {D}/>
<path d="M8.5 11.9l2.4 2.4 4.6-4.8" {SW}/>''')

add("CheckCircle2", f'''
<circle cx="12" cy="12" r="8.6" {D}/>
<path d="M7.9 12.2l2.7 2.7 5.5-5.7" {SW}/>''')

add("Lock", f'''
<rect x="4.7" y="10.3" width="14.6" height="10.5" rx="3.2" {D}/>
<path d="M8.1 10.3V7.5a3.9 3.9 0 0 1 7.8 0v2.8"/>
<circle cx="12" cy="15.5" r="1.6" {S}/>''')

add("KeyRound", f'''
<circle cx="8.2" cy="15.7" r="4" {D}/>
<path d="M11 12.9 20.2 3.7M17.4 6.5l2.2 2.2M15.2 8.7l2.2 2.2"/>''')

add("LogOut", '<path d="M9.7 3.7H6.2A2.6 2.6 0 0 0 3.6 6.3v11.4a2.6 2.6 0 0 0 2.6 2.6h3.5"/><path d="M15.4 7.4 20 12l-4.6 4.6M20 12H9.3"/>')

# ---------------------------------------------------------------- people / places
add("User", f'''
<circle cx="12" cy="8" r="3.8" {D}/>
<path d="M4.5 20.4c0-4 3.4-6.9 7.5-6.9s7.5 2.9 7.5 6.9"/>''')

add("Users", f'''
<circle cx="9.1" cy="8" r="3.2" {D}/>
<path d="M2.7 20.2c0-3.4 2.9-5.8 6.4-5.8s6.4 2.4 6.4 5.8"/>
<circle cx="16.7" cy="8.7" r="2.6"/>
<path d="M17.6 14.8c2.1.5 3.7 2.2 3.7 4.4"/>''')

add("MapPin", f'''
<path d="M12 21.2s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" {D}/>
<circle cx="12" cy="9.9" r="2.4" {S}/>''')

add("Phone", f'''
<path d="M7.7 3.5 10.3 8a1.7 1.7 0 0 1-.3 2.1L8.3 11.6a12.7 12.7 0 0 0 4.1 4.1l1.5-1.7a1.7 1.7 0 0 1 2.1-.3l4.5 2.6a1.7 1.7 0 0 1 .75 2l-.8 2a2.7 2.7 0 0 1-3 1.75C10.3 20.4 3.6 13.7 2.55 5.9A2.7 2.7 0 0 1 4.3 2.9l2-.8a1.7 1.7 0 0 1 1.9.35Z" {D}/>''')

# ---------------------------------------------------------------- comms / files
add("MessageSquare", f'''
<path d="M4.5 5.5h15a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2H9.4l-4.2 3.3a.8.8 0 0 1-1.3-.63V7.5a2 2 0 0 1 2-2Z" {D}/>
<circle cx="8.7" cy="11.2" r="1.15" {S}/><circle cx="12" cy="11.2" r="1.15" {S}/><circle cx="15.3" cy="11.2" r="1.15" {S}/>''')

add("FileText", f'''
<path d="M6.5 2.7h7l4.5 4.5v13.4a1.7 1.7 0 0 1-1.7 1.7H6.5a1.7 1.7 0 0 1-1.7-1.7V4.4a1.7 1.7 0 0 1 1.7-1.7Z" {D}/>
<path d="M13.4 2.9v4.7h4.7M8.4 12.6h7M8.4 16.2h4.8"/>''')

add("Copy", f'''
<rect x="8.3" y="8.3" width="12.4" height="12.4" rx="3.2" {D}/>
<path d="M15.6 5.4a2.7 2.7 0 0 0-2.7-2.7H6A2.7 2.7 0 0 0 3.3 5.4v6.9a2.7 2.7 0 0 0 2.7 2.7"/>''')

add("RefreshCw", '<path d="M20.4 12a8.4 8.4 0 1 1-2.65-6.15"/><path d="M20.4 3.5v4.9h-4.9"/>')

add("Headphones", f'''
<path d="M4.4 15.6v-2.4a7.6 7.6 0 0 1 15.2 0v2.4"/>
<rect x="2.6" y="14.1" width="4.1" height="6.5" rx="2.05" {D}/>
<rect x="17.3" y="14.1" width="4.1" height="6.5" rx="2.05" {D}/>''')

add("Gamepad2", f'''
<path d="M7.4 7.5h9.2a4.4 4.4 0 0 1 4.25 3.45l.95 4.7a2.6 2.6 0 0 1-4.6 2.2l-1.2-1.55H8l-1.2 1.55a2.6 2.6 0 0 1-4.6-2.2l.95-4.7A4.4 4.4 0 0 1 7.4 7.5Z" {D}/>
<path d="M8.1 11.1v2.8M6.7 12.5h2.8"/>
<circle cx="15.7" cy="11.9" r="1.2" {S}/><circle cx="18" cy="14.1" r="1.2" {S}/>''')

add("Swords", f'''
<path d="M3.9 3.9 14.4 14.4M8.2 15.5 15.5 8.2M13.2 15.2l2.3 2.3"/>
<circle cx="17.1" cy="17.1" r="1.5" {S} fill-opacity=".22"/>
<path d="M20.1 3.9 9.6 14.4M15.8 15.5 8.5 8.2M10.8 15.2l-2.3 2.3"/>
<circle cx="6.9" cy="17.1" r="1.5" {S} fill-opacity=".22"/>
''')

add("Eye", f'''
<path d="M2.4 12S5.7 6.3 12 6.3 21.6 12 21.6 12 18.3 17.7 12 17.7 2.4 12 2.4 12Z" {D}/>
<circle cx="12" cy="12" r="2.7" {S}/>''')

add("EyeOff", f'''
<path d="M3.2 12S6.4 6.8 12 6.8c1.1 0 2.1.2 3 .5M16.9 9.4a15.6 15.6 0 0 1 3.9 2.6s-3.2 5.2-8.8 5.2c-1.4 0-2.6-.3-3.7-.8"/>
<path d="M9.5 9.9a3.3 3.3 0 0 0 4.4 4.4"/>
<path d="M4.4 4.4 19.6 19.6" {SW}/>
''')

add("Clock", f'<circle cx="12" cy="12" r="8.6" {D}/><path d="M12 7.3V12l3.4 2.2"/>')
add("Clock3", f'<circle cx="12" cy="12" r="8.6" {D}/><path d="M12 12h4.5M12 12l-2.7 2.7"/>')

add("Info", f'<circle cx="12" cy="12" r="8.6" {D}/><path d="M12 10.7v5.5"/><circle cx="12" cy="7.7" r="1.25" {S}/>')
add("AlertCircle", f'<circle cx="12" cy="12" r="8.6" {D}/><path d="M12 7v5.6"/><circle cx="12" cy="16.5" r="1.25" {S}/>')
add("AlertTriangle", f'''
<path d="M12 3.2 21.35 19.55a1.4 1.4 0 0 1-1.2 2.1H3.85a1.4 1.4 0 0 1-1.2-2.1L12 3.2Z" {D}/>
<path d="M12 9v4.7"/><circle cx="12" cy="17.4" r="1.25" {S}/>''')

add("Pencil", f'''
<path d="M4.2 19.8l1-4.6 11-11a2.2 2.2 0 0 1 3.1 0l.5.5a2.2 2.2 0 0 1 0 3.1l-11 11-4.6 1Z" {D}/>
<path d="M14.6 5.4l4 4"/>''')

# ---------------------------------------------------------------- mode icons
add("ModeSolo", f'''
<circle cx="12" cy="8.2" r="3.6" {D}/>
<path d="M5 20.2c0-3.8 3.1-6.6 7-6.6s7 2.8 7 6.6"/>''')

add("ModeDuo", f'''
<circle cx="8.3" cy="8.2" r="3.1" {D}/>
<path d="M2.6 20.2c0-3.3 2.6-5.7 5.7-5.7s5.7 2.4 5.7 5.7"/>
<circle cx="16.4" cy="8.9" r="2.5"/>
<path d="M17.4 14.9c2 .5 3.5 2.2 3.5 4.3"/>''')

add("ModeSquad", f'''
<circle cx="12" cy="6.9" r="2.7" {D}/>
<circle cx="5.4" cy="9.1" r="2.1" {D}/>
<circle cx="18.6" cy="9.1" r="2.1" {D}/>
<path d="M8.4 15.4c0-2.6 1.7-4.4 3.6-4.4s3.6 1.8 3.6 4.4"/>
<path d="M6.8 20.4v-1.7c0-1.7-.9-3.1-2.2-3.6M17.2 20.4v-1.7c0-1.7.9-3.1 2.2-3.6M8.6 20.4h6.8"/>''')

add("ModeClashSquad", ICONS["Swords"])

# ---------------------------------------------------------------- brand (not mono)
BRAND = {
    "GoogleG": "google-g.svg",
    "GmailIcon": "gmail.svg",
}
MONO = list(ICONS.keys())

# ------------------------------------------------------------------ writers
import shutil

HERE = pathlib.Path(__file__).parent
PARENT = HERE.parent
SVG_DIR = HERE / "svg"
SVG_DIR.mkdir(exist_ok=True)

ROOT_ATTRS = ('fill="none" stroke="currentColor" stroke-width="2.2" '
              'stroke-linecap="round" stroke-linejoin="round"')

# brand icons parent folder se copy (self-contained folder)
for fn in BRAND.values():
    src = PARENT / fn
    if src.exists():
        shutil.copy2(src, SVG_DIR / fn)
        print("copied", fn)

for name, body in ICONS.items():
    body = body.replace("{D}", D).replace("{S}", S)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
           f'width="24" height="24" {ROOT_ATTRS}>\n{body}\n</svg>\n')
    (SVG_DIR / f"{name}.svg").write_text(svg, encoding="utf-8")

print(f"wrote {len(ICONS)} svg masters")

# ------------------------------------------------------------------ TSX
CAMEL = {"stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap",
         "stroke-linejoin": "strokeLinejoin", "fill-opacity": "fillOpacity",
         "stroke-opacity": "strokeOpacity", "fill-rule": "fillRule",
         "clip-rule": "clipRule", "font-size": "fontSize", "font-weight": "fontWeight",
         "stop-color": "stopColor", "stop-opacity": "stopOpacity"}

HEAD = """/**
 * TG icons — "Telegram jaisa" bold rounded duotone set for the EGA app.
 * Lucide-react ke SAME export names, isliye import ek line me swap ho jata hai:
 *
 *   - import { Sun, Moon, Settings, Bell } from 'lucide-react';
 *   + import { Sun, Moon, Settings, Bell } from '../icons/tg/tg-icons';
 *
 * 24x24 grid, stroke 2.2, round caps, currentColor (dark+light theme dono).
 * Design rules / sizes / preview: ./README.md
 *
 * Regenerate: python icons/tg/build.py
 */
import * as React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  title?: string;
};

const ROOT: React.SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};
"""

parts = [HEAD]
for name in ICONS:
    src = (SVG_DIR / f"{name}.svg").read_text(encoding="utf-8")
    inner = re.sub(r"^.*?<svg[^>]*>", "", src, flags=re.S).rsplit("</svg>", 1)[0].strip()
    for k, v in CAMEL.items():
        inner = inner.replace(k + "=", v + "=")
    inner = re.sub(r"\n\s*\n+", "\n", inner)
    lines = "\n".join("      " + l.strip() for l in inner.splitlines())
    parts.append(f"""
export function {name}({{ className, size = 24, title, strokeWidth, ...rest }}: IconProps) {{
  return (
    <svg
      viewBox="0 0 24 24"
      width={{size}}
      height={{size}}
      className={{className}}
      {{...ROOT}}
      strokeWidth={{strokeWidth ?? ROOT.strokeWidth}}
      {{...(title ? {{ role: 'img' }} : {{ 'aria-hidden': true }})}}
      {{...rest}}
    >
      {{title ? <title>{{title}}</title> : null}}
{lines}
    </svg>
  );
}}
""")

parts.append("""
/* ---------------- brand + composites ---------------- */

/** Google "G" — official 4-colour. login ke "Continue with Google" ke liye. */
export function Chrome({ className, size = 24, title, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className}
         role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...rest}>
      {title ? <title>{title}</title> : null}
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

const MODE_MAP = { solo: ModeSolo, duo: ModeDuo, squad: ModeSquad, cs: ModeClashSquad } as const;
export type GameMode = keyof typeof MODE_MAP;

/** Solo / Duo / Squad / CS chips ke liye ek hi entry point */
export function ModeIcon({ mode, className, size = 14, title }: IconProps & { mode: GameMode }) {
  const Cmp = MODE_MAP[mode] ?? ModeSolo;
  return <Cmp className={className} size={size} title={title} />;
}

/** Sab icons ek object me — dynamic naam se render karne ke liye */
export const TGIcons = {
""" + "".join(f"  {n},\n" for n in ICONS) + """} as const;
""")

(HERE / "tg-icons.tsx").write_text("\n".join(parts), encoding="utf-8")
print("wrote tg-icons.tsx:", len("\n".join(parts).splitlines()), "lines")

# ------------------------------------------------------------------ preview
def inline_svg(name: str, cls: str = "") -> str:
    s = (SVG_DIR / f"{name}.svg").read_text(encoding="utf-8")
    s = re.sub(r"\s(width|height)=\"24\"", "", s)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    if cls:
        s = s.replace("<svg", f'<svg class="{cls}"', 1)
    return s.strip()

NAMES = list(ICONS.keys())

def grid(names):
    return "".join(
        f'<figure class="ic">{inline_svg(n)}<figcaption>{n}</figcaption></figure>'
        for n in names
    )

TPL = """<!doctype html><html><head><meta charset="utf-8"><title>TG icons — preview</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Inter,"Segoe UI",Arial,sans-serif;display:grid;grid-template-columns:1fr 1fr}
section{padding:20px 22px;min-height:100vh}
.dark{background:#020617;color:#cbd5e1}
.light{background:#f8fafc;color:#334155}
h2{margin:0 0 14px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.5}
h3{margin:22px 0 10px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:6px}
.ic{margin:0;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 2px;border-radius:10px;
    background:rgba(148,163,184,.09)}
.light .ic{background:rgba(15,23,42,.05)}
.ic svg{width:26px;height:26px}
.ic figcaption{font-size:8.5px;letter-spacing:.02em;opacity:.55;text-align:center;line-height:1.15}
.sizes{display:flex;align-items:flex-end;gap:16px;margin-bottom:6px}
.sizes div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9px;opacity:.55}
.nav{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:290px;padding:7px 8px 10px;border-radius:14px;
     border-top:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.55)}
.light .nav{background:#fff;border-color:rgba(15,23,42,.12)}
.tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#94a3b8;
     position:relative;padding-bottom:9px}
.light .tab{color:#64748b}
.tab svg{width:20px;height:20px}
.tab.on{color:#FFD000}
.bar{position:absolute;bottom:0;width:22px;height:4px;border-radius:99px;background:#FFD000;box-shadow:0 0 8px #FFD000}
.hdr{display:inline-flex;gap:8px}
.hbtn{display:flex;height:30px;width:30px;align-items:center;justify-content:center;border-radius:9px;
      border:1px solid rgba(148,163,184,.28);background:rgba(148,163,184,.08)}
.hbtn svg{width:15px;height:15px}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:9px;border:1px solid rgba(148,163,184,.3);
      padding:5px 10px;font-size:11px;font-weight:800;color:#94a3b8}
.light .chip{color:#475569}
.chip.on{border-color:#FFD000;color:#FFD000;background:rgba(255,208,0,.13)}
.chip svg{width:13px;height:13px}
</style></head><body>__DARK____LIGHT__</body></html>"""

def block(title, inner, extra=""):
    return f'<h3>{title}</h3><div class="{extra}">{inner}</div>'

def context():
    nav = f'''<div class="nav">
<span class="tab on">{inline_svg("Trophy")}<b>Tournaments</b><i class="bar"></i></span>
<span class="tab">{inline_svg("Wallet")}<b>Wallet</b></span>
<span class="tab">{inline_svg("User")}<b>Profile</b></span></div>'''
    chips = "".join(
        f'<span class="chip{" on" if i==2 else ""}">{inline_svg(n)}<b>{lbl}</b></span>'
        for i, (n, lbl) in enumerate([("ModeSolo","Solo"),("ModeDuo","Duo"),("ModeSquad","Squad"),("ModeClashSquad","CS")])
    )
    hdr = f'''<div class="hdr">
<span class="hbtn" style="color:#FFD000">{inline_svg("Settings")}</span>
<span class="hbtn">{inline_svg("Bell")}</span>
<span class="hbtn">{inline_svg("Sun")}</span>
<span class="hbtn">{inline_svg("Moon")}</span>
<span class="hbtn">{inline_svg("ChevronRight")}</span>
<span class="hbtn">{inline_svg("X")}</span></div>'''
    return block("Bottom bar", nav) + block("Mode chips", f'<div class="chiprow">{chips}</div>', "row") + block("Header buttons", hdr)

def sizes():
    items = "".join(
        f'<div><span style="display:block;width:{s}px;height:{s}px">{inline_svg("Trophy")}</span>{s}px</div>'
        for s in (10, 12, 14, 16, 20, 24)
    )
    return block("Trophy at real app sizes (10-24px)", f'<div class="sizes">{items}</div>')

def half(cls):
    body = (block("In context", context())
            + sizes()
            + '<h2>All icons</h2><div class="grid">' + grid(NAMES) + '</div>')
    return f'<section class="{cls}">{body}</section>'

(HERE / "preview.html").write_text(TPL.replace("__DARK__", half("dark")).replace("__LIGHT__", half("light")), encoding="utf-8")
print("wrote preview.html")
