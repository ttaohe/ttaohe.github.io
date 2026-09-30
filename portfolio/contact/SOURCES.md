# Contact entry provenance

- Zhihu: user-provided profile URL, https://www.zhihu.com/people/shi-he-yuan-fang-48-94. A read-only verification request on 2026-09-30 returned HTTP 403; the exact user-provided address is retained, without claims about profile contents.
- Email: user-provided `ttaohe828@gmail.com`; the link uses `mailto:` and does not send a message automatically.
- WeChat: user-provided personal contact QR image on 2026-09-30. The QR was decoded locally and re-encoded as a code-native SVG with the identical payload, `https://u.wechat.com/MOeJmTaz1nKqChtRcluWR4c?s=2`. The rendered SVG was decoded again and its payload matched exactly. No external QR service was used. Actual friend addition in the WeChat app was not performed.
- Only the QR payload is published. The source image's nickname, location line, and surrounding profile card are excluded. The SVG contains no script, metadata, remote image, or external dependency.
- Contact symbols use standard brand silhouettes from Simple Icons (Zhihu and WeChat) and the filled envelope from Heroicons. Paths are preserved; only accessible SVG attributes and theme-aware monochrome sizing are applied. Accessible names identify their destinations.
- QR SVG SHA-256: `80ed6c2f6f32e3b7aabd1004f22513f9525ba484c93339d06169ed20c6c327f8`.
- The code-native SVG is rendered to a PNG for browser display and saving on mobile. PNG and SVG decode to the identical source payload. The original profile-card bitmap is not published.

## Icon sources and licenses

- Zhihu: https://github.com/simple-icons/simple-icons/blob/d4e6ba93e48f178898707f0145ec285f28b64b38/icons/zhihu.svg ; original Git blob c283d23e6d9678f96e5efb493a4091fef1fd2706.
- WeChat: https://github.com/simple-icons/simple-icons/blob/d4e6ba93e48f178898707f0145ec285f28b64b38/icons/wechat.svg ; original Git blob c3eb6c4a666f66fcda5df187936c5fee829d4ecb.
- Simple Icons distributes its collection under CC0, while brands retain their trademarks and may have separate rights. The upstream license and disclaimer are retained alongside this document. These marks identify links to personal accounts; no endorsement is implied.
- Email envelope: https://github.com/tailwindlabs/heroicons/blob/master/optimized/20/solid/envelope.svg ; original Git blob e0ef01b45fd83243c8bf79b4e72b169ba539ed6a. Heroicons is MIT licensed; the full copyright/license notice is retained in HEROICONS-LICENSE.
- Simple Icons metadata points to https://www.zhihu.com for Zhihu and https://wechat.design/tool/brand for WeChat. The official WeChat guide https://wechat.design/brand/main-brand/ permits a simplified monochrome mark in suitable contexts; icon geometry is not modified.
