# Console redesign — frozen visual contract (Signal direction)

`Main.dc.html` is the **frozen visual contract** for the BusTester console
redesign. The SDD change `console-redesign-signal` implements the Angular
frontend against this artboard: where a spec or design sentence is ambiguous,
the pixels in this file win.

- **Direction:** Signal — dense, data-first. Toolbar with per-queue tabs, a
  three-column workspace (compact send / dense message table / persistent reply
  rail), and a fixed bottom status bar.
- **Palette & type:** the Graphite tokens already in
  `frontend/src/styles.css` (`--color-ground: #161616`, broker accent
  `#e0a34a` RabbitMQ / `#3d8ef0` Kafka / neutral `#9a9a9a` while disconnected,
  queue hues `--color-queue-1..6`), and the app fonts (Bricolage Grotesque /
  Public Sans / JetBrains Mono).
- **Clickable canvas:** https://claude.ai/code/artifact/0cff61eb-d6eb-495a-ba1d-e21be9f3dfcb
- **Frozen:** 2026-08-31.

## Decisions baked in (differ from the earlier `DirectionSignal` sketch)

1. Typography follows the app (Bricolage / Public Sans / JetBrains Mono), not
   the sketch's Archivo / IBM Plex Mono.
2. Accent is neutral grey until a broker is connected, then follows the broker
   (decision #167 in `styles.css`) — not an always-on blue.
3. The send column keeps both **Recientes** and **Plantillas**.
4. The reply rail is always present with a dashed empty state; `✕` / `↩`
   affordances stand in for a real `Esc` keybinding.

## Connect flow

Broker segmented control (RabbitMQ | Apache Kafka), editable per-broker fields,
recent-connections quick-fill, `Probar conexión` + `Conectar` with transient
probing / ok / error states, and a `Conectado a X` panel (change broker /
disconnect) once connected. The console is blurred while the first-run modal is
open. There is no endpoint line inside the form — the endpoint string lives only
in the bottom status bar and the connected panel.

## Files

| File | Purpose |
| --- | --- |
| `Main.dc.html` | The frozen contract artboard (Design Component source). |
| `canvas.json` | Canvas layout / launch view. |
| `bustester-console-signal.html` | Seeded design-canvas export (opens in a browser; view + PNG/PDF). |

Earlier exploration sketches (`DirectionTerminal`, `DirectionStudio`,
`DirectionSignal`) and the previous two-column Graphite `Main.dc.html` live in
git history and on the abandoned `feat/console-redesign` branch (PR #44).
