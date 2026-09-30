# LaTeX template PDF preview

This is the existing example PDF from [ttaohe/resume-ng](https://github.com/ttaohe/resume-ng), not TaoHe's personal résumé. The section heading explicitly labels it as a résumé template; personal LaTeX content is pending. The owner requested the example preview with ordinary PDF zoom and text selection on 2026-09-30.

- Repository commit: `8fb52d64342171d0e3c3ec166495e31fc25271c2`
- [Original main.pdf](https://github.com/ttaohe/resume-ng/blob/8fb52d64342171d0e3c3ec166495e31fc25271c2/main.pdf)
- Exact PDF Git blob: `0e2f3224a7288370cc640952df29f99b213249b7`
- Size: 214434 bytes; one A4 page, unencrypted, no PDF JavaScript
- Original producer: xdvipdfmx (20220710); PDF metadata dates the existing artifact to 2024-03-14
- The example name, education, contact details and achievements belong to the template's sample content. They must not be copied into personal profile facts.

Drive searches for `resume-ng`, `简历` and `latex` did not locate a template archive. The explicitly named GitHub repository was used instead. The upstream repository provides the original `main.tex`, `resume.cls`, `latexmkrc` and README. Only the unchanged PDF and necessary LPPL-1.3c license are redistributed here; use the upstream link for template sources.

A safe local XeLaTeX compilation was attempted with shell escape disabled. It failed before producing a PDF because the environment lacked the XeLaTeX format and Chinese TeX dependencies. The published PDF is therefore the repository's original, byte-verified PDF, not a newly compiled artifact. It was rendered and visually inspected, and its text extraction was checked.

The embedded same-origin PDF uses the browser's native PDF viewer. The section heading has a small direct-open filename link; downloading remains in the native PDF toolbar. The user requested removal of the extra explanatory heading and duplicate custom toolbar on 2026-09-30. PDF toolbar availability varies by browser, especially on mobile. The PDF remains white in all site themes. Replacing it later requires the user's actual LaTeX/PDF and an updated provenance record; do not replace sample text with guessed personal content.
