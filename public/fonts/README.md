# Fonts

Merriweather (headings) is open source (SIL Open Font License) and its files
are already here: `Merriweather-400.woff2` and `Merriweather-700.woff2`.

Owners (body text) is a commercial font, so it isn't included in this
repository. Put your licensed web font files here using these names:

| Font   | File names                                            |
|--------|-------------------------------------------------------|
| Owners | `Owners-Regular.woff2` (and/or `Owners-Regular.woff`) |

If your files have different names, update the `url(...)` lines at the top of
`public/stylesheets/theme.css`.

Until the files are here, visitors who have the font installed on their own
computer still see it. Everyone else sees the fallback fonts listed in
`--font-body` in `theme.css`.

Check that your font license covers **web embedding**. A desktop license
usually doesn't.
