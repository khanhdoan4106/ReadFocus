# Privacy

ReadFocus processes your PDFs and all reading data on your own computer. By default nothing is sent anywhere. There is no analytics, no telemetry, no advertising and no library loaded from a CDN. The one exception is the optional AI features, which run only when you ask for them (see _AI features_ below).

This is the English version of [`PRIVACY.md`](PRIVACY.md). If the two ever differ, the code and the permission list in [`PERMISSIONS.md`](PERMISSIONS.md) are the source of truth.

## Data stored on your computer

When you open a document, ReadFocus stores the following in the extension's IndexedDB (database `readfocus`):

- file name, size, page count and the time you opened it;
- text extracted from each page (used for search and reading-time estimates), including text recognized by OCR with the position of each word;
- the table of contents and the search index;
- the page you are on and the time you have read;
- reading statistics: minutes and pages per day;
- settings such as theme, interface language, reading speed, Pomodoro and the focus band height;
- AI summaries you generated (cached, with the provider and model used), if any;
- semantic-search vectors, question history and flashcards (with box and review date) per document, if you used those features.

In addition:

- **`localStorage`** holds two values so the viewer can paint in your theme and language before it finishes loading: `readfocus:theme` and `readfocus.uiLanguage`.
- **`chrome.storage.local`** holds your AI settings and, if you chose to save it, your API key. It is not synced.
- **`chrome.storage.session`** holds the API key instead if you turn off **Keep key on this computer**; it is cleared when the browser closes.
- **`chrome.storage.sync`** holds only the `autoOpenPdf` flag (whether PDFs open automatically). If you are signed in to Chrome, Chrome may sync this flag through your Google account. No document content is ever synced.

Your original files are never modified and never copied off your computer.

## Data that is not sent anywhere

- There is no ReadFocus server.
- The content of your PDFs, extracted text, table of contents, search terms and reading statistics are not sent to anyone.
- There is no tracking code and no remotely loaded code: every library is bundled in the extension.

## PDFs opened from the web

When you open a PDF from the web on purpose (right-click → **Open with ReadFocus**, click the toolbar icon on a PDF tab, or turn on auto-open), the extension downloads that address to your computer to display it. The server hosting the file sees an ordinary request, including your IP address, just as with a normal browser download. ReadFocus sends nothing else.

If you turn on **Auto-open PDFs in ReadFocus**, Chrome asks for access to websites. This permission is used only to recognize and redirect links that end in `.pdf`; ReadFocus does not read the content of the pages you visit and does not record your browsing history.

## Extension permissions

The full list and the reason for each permission is in [`PERMISSIONS.md`](PERMISSIONS.md). In short:

- `storage`, `notifications`: store data locally and notify you when a timer ends.
- `contextMenus`, `activeTab`: add **Open with ReadFocus** and read the current tab's address when you click the icon or the menu item.
- `declarativeNetRequestWithHostAccess`: add or remove the PDF redirect rule when you turn auto-open on or off.
- The host permission `*://*/*` is optional and is requested only when you turn on auto-open.
- Host permissions for AI provider addresses are optional and are requested only when you use an AI feature.

## Deleting your data

In the **Settings** tab of the viewer:

- **Delete data for “name”** removes progress, text, table of contents and search index of the open document.
- **Delete all reading data** removes the data of every document and the statistics; theme, language and reading-speed settings are kept.

Uninstalling the extension from Chrome also deletes ReadFocus's IndexedDB and `localStorage`.

## AI features

These are off until you set them up in **Settings → AI**. They use the provider and API key you choose.

**What is sent.** When you click **Summarize section** or **Summarize everything**: the extracted text of the chosen section(s), the section title, the document type and the summarizing instructions. The original PDF, page images, file name, reading history and statistics are not sent. **Test connection** sends one short fixed question with no document content.

**Who receives it.** Only the provider you chose, over a direct connection from your browser, never through a ReadFocus server:

- OpenAI (`api.openai.com`), Google Gemini (`generativelanguage.googleapis.com`) or Anthropic (`api.anthropic.com`);
- or an OpenAI-compatible address you enter. With Ollama or LM Studio running on your computer the data does not leave it; if you point to another service, the data goes to that service.

How a provider stores or uses data depends on its terms and your account settings, which ReadFocus cannot control. Think before sending sensitive documents.

**When.** The first time you click **Test connection**, ReadFocus shows a dialog explaining that data will be sent; nothing is sent unless you agree. Chrome also asks for access to that provider's API address at that moment; the permission is optional and is never requested at install. After that, a request is sent only when you click a summarize, search, ask, flashcard or test button. **Summarize everything** always shows an estimate of requests and tokens and asks for confirmation.

**Where the key is kept.** Only on your computer, in `chrome.storage.local` by default, or in `chrome.storage.session` if you turn off **Keep key on this computer**. The key is not synced through your Chrome account and is sent only to the provider you chose (in a request header). Note that `chrome.storage.local` is not encrypted: another user of the computer, or software that can read your Chrome profile, could read the key.

**Results.** Summaries are saved in IndexedDB (store `summaries`) so they need not be requested again. Results are shown as plain text; ReadFocus does not render HTML and does not open links in them automatically.

**How to delete.**

- **Remove key** (Settings → AI) removes the key and keeps the provider and model.
- **Delete data for “name”** and **Delete all reading data** also delete the summaries of the matching documents.
- Uninstalling the extension deletes all ReadFocus data, including the key and summaries.
- To revoke access to a provider: `chrome://extensions` → ReadFocus → Details → Site access. If a key may have leaked, revoke it in the provider's own console.

## Semantic search and Q&A

These use the same provider, key and permissions as summaries and run only when you click a button. Anthropic has no embeddings API, so the provider source can't be used for semantic search with it; you can still pick the **On this device** source (see *On-device embeddings*).

**Semantic search.**

- **Build semantic index** (Search tab, **By meaning** on) sends _the whole extracted text of the document_, split into passages of about 300 words, to the provider to create vectors. ReadFocus shows a dialog with the number of passages, requests, the provider and the model before sending; this may cost money under the provider's pricing.
- Each time you click **Search** in this mode, your query is sent to that provider to create a matching vector. Typing in the box sends nothing; keyword search still runs entirely on your computer.
- Vectors are stored in IndexedDB (store `embeddings`), tied to the provider, model and API address used; if you change the model, the old index is not reused.

**Q&A.** Each question is one request. It sends _the question and the few most relevant passages of the document_ (with page numbers). Questions and answers are stored in IndexedDB (store `qa`) so you can review them, and are shown as plain text. A page citation is shown only if it can be verified against that page's text.

**Deleting.** The **Delete** and **Clear question history** buttons in the Ask tab; **Delete data for “name”** and **Delete all reading data** also remove vectors and question history.

## Text recognition (OCR)

OCR runs entirely on your computer. The library, the WebAssembly files and the language data (Vietnamese, English) are inside the extension; nothing is downloaded and no page image or recognized text is sent anywhere. Recognized text is stored with the page text (IndexedDB, store `pages`) and is deleted with the document's data.

## Flashcards

Cards built from existing summaries make no network request. **Create more with AI** sends the text of the section you are reading to your AI provider (one request) after the same consent dialog and access request as summaries. Cards are stored in IndexedDB (store `flashcards`), can be deleted one by one or all at once in the Flashcards tab, and are deleted with the document's data. **Export CSV** only creates a file on your computer.

## On-device embeddings (optional)

In **Settings → AI → Embedding source** you can choose **On this device** instead of the AI provider. Semantic search and Ask then create vectors on your computer; document text, search queries and questions are not sent anywhere to create vectors. This source also works when the provider is Anthropic.

**Downloading the model (once, only if you agree).** **Download model** opens a confirmation that states the size (about 129 MB) and the source. Only when you click **Download** does ReadFocus fetch the files of the `Xenova/multilingual-e5-small` model (MIT license, an ONNX build of `intfloat/multilingual-e5-small`, supports Vietnamese), pinned to a commit, from Hugging Face (`huggingface.co`; large files are redirected to `*.hf.co`): the weights and the tokenizer. Hugging Face only sees the file requests and your IP address, as with any browser download; no document text is sent. You can cancel midway; an unfinished download isn't saved.

**Where it is stored and how to delete it.** The model lives in the browser's Cache API (the `transformers-cache` cache of the extension page) and works offline afterwards. **Delete model** in Settings → AI removes all of these files. Vectors made with the model are stored in IndexedDB (store `embeddings`) under their own source key, never mixed with provider vectors, and are deleted with the document's data. The model runs in a Web Worker with the ONNX runtime (WebAssembly) bundled in the extension (`ort/`); no libraries or code are loaded from the network.

After the download, ReadFocus doesn't contact Hugging Face again: running the model only reads from the cache and refuses network requests.

