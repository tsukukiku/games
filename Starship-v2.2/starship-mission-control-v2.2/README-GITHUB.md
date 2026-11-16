# Starship Mission Control v2.2

## Run locally / on Synology
Place `index.html` and `three.min.js` together in the public web directory.
Game can run as static HTML, no database or backend.

## GitHub Pages
1. Create a GitHub repository (e.g. `starship-game`).
2. Upload `index.html`, `three.min.js` to repository root (other files are optional).
3. Open Settings → Pages → Source: Deploy from a branch; Branch: `main`; Folder: `/(root)`; Save.
4. Open `https://YOUR_USERNAME.github.io/starship-game/` after deployment.

## English radio
At game launch, and for selected mission events, a built-in English voice reads short original mission-control radio phrases.
In pause menu, **English Radio** toggles only the voice; **Sound** controls all audio.
Uses `speechSynthesis` (English-language system voice), no external sound files. It depends on device voice support.

The game is an unofficial fan simulation, not affiliated with SpaceX.
