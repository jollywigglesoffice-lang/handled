#!/usr/bin/env python3
"""Move OPENAI_API_KEY -> OPENROUTER_API_KEY when value is an OpenRouter key (sk-or-v1-)."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / ".env.local"
lines = p.read_text().splitlines()
openai_val = None
out: list[str] = []
for line in lines:
    if line.startswith("OPENAI_API_KEY="):
        openai_val = line.split("=", 1)[1].strip()
        continue
    if line.startswith("OPENROUTER_API_KEY="):
        continue
    out.append(line)
if not openai_val:
    raise SystemExit("No OPENAI_API_KEY= line found in .env.local")
out.append(f"OPENROUTER_API_KEY={openai_val}")
p.write_text("\n".join(out) + "\n")
print("OK: OPENROUTER_API_KEY set; OPENAI_API_KEY removed")
