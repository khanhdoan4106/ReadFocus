# Permission justifications for the Developer Dashboard (Privacy tab)

English text to paste into the form. It must match `manifest.json` and [`docs/PERMISSIONS.md`](../docs/PERMISSIONS.md); change all three together. The Dashboard asks for a justification per permission, for host permissions, for single purpose and for remote code.

## Single purpose

Read PDF documents more comfortably in a dedicated viewer: table of contents, search, reading-time estimates, timers and a focus mode. Optional AI summaries, questions and flashcards use the user's own API key.

## Permissions in `manifest.json`

| Permission                            | Justification to paste                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                             | Saves reading progress, extracted text, search index, settings and (optionally) the user's AI API key on the user's own device. Nothing is synced except one on/off flag for auto-opening PDFs and, only if the user turns on "Sync reading progress" (off by default), one small entry per document (page, page count, time) through `chrome.storage.sync`, which is covered by this same `storage` permission. |
| `notifications`                       | Tells the user when a chapter timer, Pomodoro session or break ends, including when the viewer tab is in the background. Notifications carry no document content and nothing is sent anywhere.  |
| `contextMenus`                        | Adds one item, "Open with ReadFocus", to the right-click menu of a page or link so the user can open a PDF in the viewer.                                                                       |
| `activeTab`                           | When the user clicks the toolbar icon or the menu item, reads the address of the current tab so the viewer opens that PDF. It is granted only after the user's action and does not track browsing. |
| `declarativeNetRequestWithHostAccess` | Adds and removes one dynamic rule that redirects top-level navigations to `.pdf` addresses to the viewer, only when the user turns on "Auto-open PDFs". The permission does not read page content. |

## Optional host permissions (never requested at install)

| Pattern                                                                                                  | When it is requested                                                      | Justification to paste                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*://*/*`                                                                                                | When the user turns on "Auto-open PDFs" in Settings                       | Chrome ignores the path in a host permission, so recognizing links that end in `.pdf` on any site needs this origin pattern. Used only for the redirect rule; page content is not read or stored. |
| `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.anthropic.com/*` | When the user first uses an AI feature with that provider                 | Sends text to the AI provider the user chose, only after a click, using the user's own key.                                                                                                        |
| `http://localhost/*`, `http://127.0.0.1/*`                                                               | When the user selects an OpenAI-compatible provider on their own computer | Lets the user run summaries against a local server such as Ollama or LM Studio, so no data leaves the computer.                                                                                    |

Other manifest entry: `web_accessible_resources` exposes `viewer.html` with `matches: ["<all_urls>"]`, needed so the redirect rule is allowed to open the extension's viewer page.

## Remote code

"No, I am not using remote code." All libraries (pdf.js, Tesseract.js OCR with its WebAssembly core and Vietnamese/English language data, search) are bundled in the package. The extension-pages CSP is `script-src 'self' 'wasm-unsafe-eval'`; `'wasm-unsafe-eval'` only allows compiling the extension's own bundled WebAssembly (OCR, and the ONNX runtime for the optional on-device embedding model). The model weights are not part of the package; they are downloaded from Hugging Face only after the user confirms, and no extra host permission is needed for that download.

## Verified against the code

Checked while writing this file (13 Nov 2026):

- Network calls in `src/`: `src/core/llm/http.ts` (AI provider request, after a user click) and `src/viewer/hooks/useDocument.ts` (downloads the PDF address the user chose to open). No other `fetch`.
- `notifications.create` is in `src/viewer/hooks/useFocusTimer.ts`; `contextMenus`, `declarativeNetRequest`, `storage.sync` and `action.onClicked` are in `src/background/service-worker.ts` and `src/viewer/hooks/useSettings.ts`.
- `docs/PERMISSIONS.md` had a stale path for `notifications` (`App.tsx`, before T25) and `docs/PRIVACY.md` listed one `localStorage` key instead of two (`readfocus:theme`, `readfocus.uiLanguage`); both fixed in this branch.
