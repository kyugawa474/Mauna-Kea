# Design source

A snapshot of the **Mauna Kea Mobile** design canvas, which is the prototype the app is built from:
https://claude.ai/artifact/A7DUV6UoyujtRN6gTsbVKZ

- `canvas/canvas.json` holds the board layout: positions, titles, and which page each board is on ("Current prototype" or "Explorations").
- Each board is a `canvas/*.dc.html` file. The markup and styles are in `<x-dc>`, and the data and logic are in the `Component` class at the bottom.
- **`TodayLayeredB.dc.html` is the current Today prototype** (sun + water). The app's Today screen, + panel, and Training tab are ported from it.
- `ZoneE.dc.html` is the time-in-zone treatment used on Training.

These files need the canvas runtime (`support.js`), so they don't render if you open them straight from disk. View them on the canvas link above. Keep them here as reference: the source of truth for numbers, colours and timings when porting.

The canvas is the live design. This folder is a copy taken on 2026-11-05.
