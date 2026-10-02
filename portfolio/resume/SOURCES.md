# Personal LaTeX resume

`ttaohe-resume.pdf` is the approved fifth revision compiled for ttaohe on 2026-10-02. It replaces the earlier personal PDF. It preserves the confirmed education and employment dates, including overlapping employment periods. It adds verified email/GitHub/homepage contacts, a short factual technical focus, a concise MLA L2 Host cache deduplication description, and an attributed Song-font quotation. No unverified performance numbers or proficiency claims are included.

## Sources and license

- [Editable LaTeX source project and build instructions](https://drive.google.com/drive/folders/1xvs4yirNncQ1rcIww8q-Y3rKCl13seY4)
- [Exact v5 source archive, including template and icon-font licenses](https://drive.google.com/file/d/1jFu43K0B9GuZQ2mI09174G-4x9-hMaff/view)
- Template: [ttaohe/resume-ng at 8fb52d64342171d0e3c3ec166495e31fc25271c2](https://github.com/ttaohe/resume-ng/tree/8fb52d64342171d0e3c3ec166495e31fc25271c2)
- Original project: [fky2015/resume-ng](https://github.com/fky2015/resume-ng)
- Template license: LPPL 1.3c; the original license remains in `LICENSE`
- Contact icons: unmodified [Font Awesome Free 5.15.4](https://github.com/FortAwesome/Font-Awesome/tree/5.15.4/otfs) Solid and Brands desktop fonts, SIL OFL 1.1; licenses and exact font files are included in the source archive
- Quotation: Su Shi, [稼说（送张琥）](https://zh.wikisource.org/zh-hans/稼說（送張琥）), public-domain original text

This is a derived personal document. The sample resume contents were replaced and PDF metadata set in `main.tex`. The upstream `resume.cls` and `latexmkrc` remain unchanged. The editable source and compiled document are available together in the exact source archive above.

## Verified build

- Compiler: XeTeX 0.999996, TeX Live 2025/dev/Debian, LaTeX2e 2024-11-01 patch level 2
- Build driver: latexmk 4.86; PDF converter: xdvipdfmx 20240305
- PDF: 72,721 bytes, one A4 page, unencrypted, no JavaScript
- SHA256: `d456ea705a824366fc17c92ea7df1951da023fd143624603e2b5ed09749dc9b4`
- Rendered at 150 dpi and visually checked; extracted text matches the approved source
- All twelve used fonts embedded; Chinese and Latin text extraction verified; no missing-glyph or layout-overflow warnings
- Three contact URI annotations verified against the confirmed email, GitHub profile and homepage

Reference typography uses FandolHei headings, FandolSong body and quotation, FandolKai secondary information, and Latin Modern Latin text. The Latin name uses bold sans-serif. A4 margins, base type sizes and 1.15 line spacing follow the template.

Projects are automatically numbered. The approved black bold title, “1. MLA L2 Host Cache Deduplication”, sits above a compact 4% gray rounded body block, without shadows or a heavy border. Envelope, GitHub and globe icons are monochrome and embedded. Decorative icon spans have empty ActualText so supporting PDF readers can extract contacts without icon glyph noise.

The same-origin iframe preserves the browser's native PDF controls for zoom, selection and download. Toolbar availability varies by browser, especially on mobile. The direct-open link is retained and the PDF stays white in all site themes. Published asset filenames use a content hash so new HTML requests the correct version.
