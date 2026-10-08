# Sidebar and chat spacing — 8 October 2026

Inner pages retain the 124px right gutter above the 900px breakpoint for the
100px trust rail. Introduction/form grids stack from 901px to 1100px.

The desktop/iPad landscape rail now starts at the top of the hero form box,
rather than at the viewport top or centre. Pages without a hero form use the
page introduction. Scrolling recalculates the top while keeping the rail below
any visible navigation. Its available height is the remaining viewport space,
and the complete stack scrolls independently when needed.

The chat launcher is placed directly after Free Assessment in the trust stack,
centred with spacing. It is no longer a separate floating corner button. Below
901px it stays in the existing in-flow trust block. The chat dialog remains a
separate overlay, clear of the desktop rail; closing and keyboard access remain.
The script URL is versioned to bypass the previous cached positioning code.

Validation: build, content/URL-map/SEO/review validators, existing runtime tests,
and mocked geometry checks covering header clearance, form alignment, desktop,
iPad portrait/landscape and mobile breakpoints. These checks are not rendered
browser or physical iPad sign-off; the managed browser skill was unavailable.

Source changes and this documentation are synced to SDS_Website2. Generated
page snapshots can be regenerated with `npm run build`.
