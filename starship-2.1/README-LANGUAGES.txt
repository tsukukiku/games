Starship Mission Control v2.1 — CN / EN / JP
==================================================

1) Start
Open index.html with three.min.js in the same directory.
On Synology, upload index.html and three.min.js to the web folder.
The game engine and data are included; no CDN is required for gameplay.

2) Choose language
Use EN / CN / JP at the top of the home page.
All three languages share the same game stages, controls, settings, and checkpoints.
Selected language is saved locally in the browser as mc.language.

3) Mobile fullscreen
Start Mission and Resume Checkpoint request browser fullscreen mode.
Some mobile browsers, particularly iPhone Safari, do not grant ordinary
HTML page fullscreen. The game still fills the available viewport there.
If supported, orientation lock is requested; otherwise turn the phone manually.
Return to main menu exits fullscreen when supported.

4) Editable source
source/src/index.tpl.html — HTML and CSS
source/src/ui.js — unchanged flight simulation/control flow apart from the
  fullscreen call at mission start and return-to-menu.
source/src/locale.js — EN/CN/JP translations and fullscreen helper
source/build.js — build command updated to include locale.js
Build: cd source && node build.js
The built source/dist/index.html is ready for offline usage with its
source/dist/three.min.js.

5) Caveat
This is a text-localization layer, not three separate gameplay engines.
Long and generated mission guidance messages may retain some original wording
where they are not covered by the translation glossary. The physics, stages,
score, save keys, and control mappings were left unchanged.
