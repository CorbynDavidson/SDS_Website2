# Sidebar and chat spacing — 8 October 2026

Inner pages reserve a 124px right gutter above the 900px breakpoint for the
existing 100px review/trust rail. The homepage retains its existing layout.
Inner-page introduction/form grids stack between 901px and 1100px to account
for the reduced usable width. The complete trust stack is anchored near the top
in short desktop/tablet viewports.

The chat launcher and dialog sit 124px from the right edge when the rail is
fixed. At smaller widths, where the trust bar is in normal document flow, the
launcher moves above the Free Assessment link only while their bounds overlap.
Scroll, resize and layout changes update that spacing. The chat script URL has
a new version query to bypass previously cached JavaScript.

Validation: build, content/URL-map/SEO/review validators, 33 Node tests and two
Python SEO tests; launcher collision checks at desktop, iPad and mobile widths.
These are automated source/runtime checks, not a rendered-browser or physical
iPad sign-off. The managed browser skill was unavailable in this session.

GitHub contains the changed source files; generated page snapshots can be
regenerated with `npm run build`.
