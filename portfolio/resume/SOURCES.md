# Personal LaTeX resume

`ttaohe-resume.pdf` is the reference-style personal resume revision compiled for ttaohe on 2026-10-02. It replaces the upstream example PDF. The name is ttaohe; the education and employment entries use confirmed information. Contact details, skills, projects and the personal summary are intentionally blank. Overlapping employment dates are retained as supplied.

## Sources and license

- [Editable LaTeX source project and build instructions](https://drive.google.com/drive/folders/1xvs4yirNncQ1rcIww8q-Y3rKCl13seY4)
- [Complete source archive, including the license](https://drive.google.com/file/d/1AdorL06IeRT-8l4KtIaQ8udoiwCLiuFE/view)
- Template: [ttaohe/resume-ng at 8fb52d64342171d0e3c3ec166495e31fc25271c2](https://github.com/ttaohe/resume-ng/tree/8fb52d64342171d0e3c3ec166495e31fc25271c2)
- Original project: [fky2015/resume-ng](https://github.com/fky2015/resume-ng)
- LPPL 1.3c; the original license remains in `LICENSE`

This is a derived personal document. The sample resume contents were replaced, PDF metadata was set, the reference Fandol font family restored, and the added section spacing reduced in `main.tex`. The upstream `resume.cls` and `latexmkrc` are unchanged. The editable source and compiled document are available together in the linked source archive.

## Verified build

- Compiler: XeTeX 0.999996, TeX Live 2025/dev/Debian, LaTeX2e 2024-11-01 patch level 2
- Build driver: latexmk 4.86; PDF converter: xdvipdfmx 20240305
- PDF: 31,061 bytes, one A4 page, unencrypted, no JavaScript
- SHA256: `f4f631e10ba7887372e24d953406cfd0504748852ca9e65e57cba02ad90747fc`
- Rendered at 150 dpi and visually checked; extracted text matches the source
- All seven used fonts embedded; Chinese and Latin text extraction verified; no missing-glyph or layout-overflow warnings

The same-origin iframe preserves the browser's native PDF controls for zoom, selection and download. Toolbar availability varies by browser, especially on mobile. The direct-open link is retained and the PDF stays white in all site themes. Published asset filenames use a content hash so new HTML requests the correct version.

Reference typography: FandolHei headings, FandolSong body, FandolKai secondary information, and Latin Modern Latin text. The Latin name uses bold sans-serif to preserve the reference title hierarchy. A4 margins, base type sizes and 1.15 line spacing follow the template. Blank sections are not filled with invented content.
