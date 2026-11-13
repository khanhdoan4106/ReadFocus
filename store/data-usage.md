# Data usage disclosure (Privacy practices tab)

The Dashboard shows a list of data types to tick as "collected" and then asks for certifications. The exact option names are only visible inside the Dashboard; the public docs do not list them. The mapping below uses the categories from the Chrome Web Store user-data FAQ. **Check each name against the form before submitting.**

Source for the categories: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (personally identifiable information, financial and payment information, health information, authentication information, website content and resources, form data, web browsing activity, personal communications, user-generated content).

## What ReadFocus does with data

| Data                                                                                                  | Leaves the device?                                                                                       | Where in the code                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| PDF text, reading progress, statistics, settings                                                      | No. IndexedDB and `chrome.storage` on the device                                                         | `src/storage/`                                    |
| OCR images and recognized text                                                                        | No. OCR runs on the device                                                                               | `src/viewer/ocr.ts`, OCR bundle in `dist/ocr/`    |
| Section text, a question with the best passages, a search query, passages for embeddings, section text for AI flashcards | Yes, only after a user click, only to the AI provider the user chose (or a local server) | `src/core/llm/http.ts`                            |
| On-device embeddings (optional): document passages, search queries and questions turned into vectors | No. They are computed on the device by a model the user chose to download. The one-time download (about 129 MB) contacts `huggingface.co` and `*.hf.co`; Hugging Face sees only file requests and the IP address, no document text, and only after the user confirms | `src/embed-worker/`, `src/core/embed/local*.ts` |
| Reading progress sync (optional, off by default): page, page count and time per document, keyed by the first 32 characters of the file's SHA-256 | Only if the user turns it on: goes through `chrome.storage.sync` (Google's Chrome Sync, same Chrome account). No file name, text, notes, highlights or keys. Never read by the developer | `src/core/sync/`, `src/viewer/hooks/useProgressSync.ts` |
| AI API key                                                                                            | Stored on the device; sent only to the provider the user chose, as a request header                      | `src/storage/ai.ts`, `src/core/llm/auth.ts`       |
| URL of a PDF opened from the web                                                                      | The viewer downloads that URL; the file's server sees a normal request. The URL is not sent anywhere else | `src/viewer/hooks/useDocument.ts`                 |
| File name, page images, reading history, statistics                                                   | Never sent                                                                                               | n/a                                               |
| Collection by the developer                                                                           | None. There is no ReadFocus server, analytics or telemetry                                               | n/a                                               |

Note on the Dashboard form: optional reading-progress sync stores a one-way hash and page numbers through the user's own Chrome Sync. It is not sent to the developer or any third party chosen by the developer; whether it counts as "collected" is the developer's judgement (the conservative choice is to mention it in the privacy policy, as `docs/PRIVACY.en.md` does).

## Suggested ticks

These are the data types that can reach a third party (the user's chosen AI provider) because the user triggered it. Whether the Dashboard counts "sent to a provider the user configured" as "collected" is the developer's judgement; the conservative choice is to disclose.

- **Website content** (text of the documents the user opens, which may come from websites): tick, because document text is sent to the AI provider when the user asks.
- **Authentication information** (the user's own API key): tick, because the key is sent to the provider it belongs to.
- **User-generated content** (questions typed in the Ask tab, search queries in semantic mode): tick, because they are sent to the provider when the user clicks.

Leave unticked: personally identifiable information, health, financial and payment, personal communications, location, web browsing activity (the extension does not collect browsing history; with auto-open it only redirects `.pdf` links and keeps no record), form data.

## Certifications

The Dashboard asks you to certify compliance with its data-use statements. The usual three are listed below; read the live wording before ticking.

1. Data is not sold to third parties outside the approved use cases. True: nothing is sold.
2. Data is not used or transferred for purposes unrelated to the item's single purpose. True: AI requests serve only the feature the user clicked.
3. Data is not used or transferred to determine creditworthiness or for lending. True.

## Privacy policy URL

Use the English policy: `https://github.com/khanhdoan4106/ReadFocus/blob/main/docs/PRIVACY.en.md` (works after merge). It must stay consistent with this file and `permissions.md`.
