# Chrome Web Store listing — English (default locale)

Text to paste into the Developer Dashboard → Store listing. Nothing here is uploaded automatically.

## Name

ReadFocus

(Comes from `__MSG_extName__` in the manifest; the dashboard shows the manifest value.)

## Summary (from manifest `description`, 132 characters at most)

Read PDFs more comfortably: automatic table of contents, search, reading-time estimates and a focus mode.

(105 characters. This is `extDescription` in `public/_locales/en/messages.json`.)

## Category

Productivity. Confirm the exact category and sub-category names in the dashboard dropdown; the docs do not list them.

## Language

English (default). A Vietnamese listing is in `listing.vi.md`.

## Detailed description

ReadFocus is a PDF reader for books, papers and lecture slides. It opens a PDF in its own tab and helps you see how much is left, find things, and keep your attention on the line you are reading.

Reading
• Automatic table of contents, built from the PDF's headings and bookmarks
• Time left in the section and in the document, based on your own reading speed
• Search with Vietnamese-aware matching: "chuong" finds "chương"
• Remembers the page you were on in each document
• Light, dark or system theme; English or Vietnamese interface

Staying focused
• Read-a-chapter timer and Pomodoro sessions with a notification when time is up
• Focus mode: the page is dimmed except for a bright band that follows your mouse or the ↑ ↓ keys
• Daily minutes and pages, kept on your computer

Scanned PDFs
• Text recognition (OCR) for Vietnamese and English that runs on your computer, so scanned pages become searchable. Recognized text can be wrong; pages carry an "OCR" label.

Optional AI help (off until you set it up)
• Summaries of a section or the whole document, with key points that link to pages
• Search by meaning, and questions about a document whose answers cite the exact page
• Flashcards from summaries, with a simple review schedule and CSV export for Anki
• You bring your own API key (OpenAI, Google Gemini, Anthropic, or an OpenAI-compatible server such as Ollama or LM Studio on your own computer). Text is sent only when you click a button, only to the provider you chose, and never through a ReadFocus server.

Privacy
• No account, no analytics, no ads, no remote code
• Your documents and reading data stay in your browser's own storage
• Chrome asks for access to websites only if you turn on "Auto-open PDFs", and for an AI provider's address only when you use AI

Open a PDF with the toolbar button, by dragging a file in, or from a web page via right-click → "Open with ReadFocus". Opening local files (file://) needs "Allow access to file URLs" in chrome://extensions.

## Screenshot captions (optional)

Screenshots are in `store/screenshots/en/`.

1. 01-reading-toc: "Table of contents and time left, for any PDF"
2. 02-search: "Search the whole document"
3. 03-summary: "Optional AI summary with page links (sample output)"
4. 04-focus-mode: "Focus mode keeps a bright band on the line you read"
5. 05-ocr: "On-device OCR for scanned pages"

The AI text in screenshot 3 is sample output, not a real model answer; keep "(sample output)" in the caption.

## Links

- Privacy policy URL: `https://github.com/khanhdoan4106/ReadFocus/blob/main/docs/PRIVACY.en.md` (valid after this branch is merged; the Vietnamese policy is `docs/PRIVACY.md`)
- Support / homepage: the repository `https://github.com/khanhdoan4106/ReadFocus`
