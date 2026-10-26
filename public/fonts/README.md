# Fonts

Cooper Black (headings) and Owners (body text) are commercial fonts, so they
aren't included in this repository. Put your licensed web font files here
using these names:

| Font         | File names                                     |
|--------------|------------------------------------------------|
| Cooper Black | `CooperBlack.woff2` (and/or `CooperBlack.woff`) |
| Owners       | `Owners-Regular.woff2` (and/or `Owners-Regular.woff`) |

If your files have different names, update the `url(...)` lines at the top of
`public/stylesheets/theme.css`.

Until the files are here, visitors who have the font installed on their own
computer still see it. Everyone else sees the fallback fonts listed in
`--font-heading` / `--font-body` in `theme.css`.

Check that your font license covers **web embedding**. A desktop license
usually doesn't.
