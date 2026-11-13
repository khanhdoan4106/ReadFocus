// Chụp ảnh màn hình cho Chrome Web Store (T29). Chạy tay: `npm run screenshots`.
// Không nằm trong `npm test` hay CI: script mở Chromium thật và nạp extension đã build trong dist/.
//
// Cần một lần: `npx playwright install chromium` (tải trình duyệt ~120 MB), `npm run build`,
// `npm run fixtures` và `npm run fixtures:scan` (PDF tự tạo trong tests/fixtures/).
//
// Tuỳ chọn: `--lang=en` hoặc `--lang=vi` để chỉ chụp một ngôn ngữ; `--skip-ocr` bỏ ảnh OCR (chậm nhất).
//
// Dữ liệu minh hoạ: ảnh "Tóm tắt" dùng câu trả lời AI GIẢ LẬP do script trả về cho một server
// OpenAI-compatible ở localhost:11434 (không có model hay API thật). Xem store/screenshots/README.md.
/* global chrome */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { en } from '../src/i18n/en.ts';
import { vi } from '../src/i18n/vi.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const fixtures = join(root, 'tests', 'fixtures');

/** Kích thước ảnh chụp store: 1280x800 (ưu tiên), đầy tràn, góc vuông. */
const VIEWPORT = { width: 1280, height: 800 };

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--lang='))?.slice('--lang='.length);
const skipOcr = args.includes('--skip-ocr');

/** Nội dung tài liệu minh hoạ: tự viết, không có bản quyền. */
const DOCS = {
  en: {
    title: 'Reading with focus',
    chapters: [
      [
        'Chapter 1',
        'Why attention is scarce',
        [
          'Reading is a conversation between a page and a tired mind. Most people lose focus long before they lose interest, and a clear plan for the next twenty minutes helps more than willpower.',
          'Decide what you want from the chapter before you read it. Skim the headings first, then return to the parts that matter. Short sessions with a visible end are easier to start and to repeat.',
          'When the timer stops, write one sentence about what you learned. That sentence is the cheapest review you will ever do.',
          '### Before you start',
          'Pick one question the chapter should answer and write it at the top of a page. Reading with a question turns a long text into a search, and a search is easier to stay with than a duty.',
          'Clear the desk of everything except the book and a pen. Put the phone in another room if you can; a notification costs far more than the seconds it takes to read.',
          '### When your mind wanders',
          'Wandering is normal, not a failure. Notice it, mark the line where you left, and return without scolding yourself. Each return is a small repetition of the skill you are building.',
        ],
      ],
      [
        'Chapter 2',
        'Reading in focused sessions',
        [
          'A focused session has a start, a target and a break. Choose a chapter, set a time, and leave the rest of the book alone.',
          'Take a real break when the session ends: stand up and look away. Five minutes of rest repays the effort of the next session.',
          'Keep a quiet record of pages and minutes, never a score to beat. Consistency matters more than a single heroic evening.',
          '### Choosing the length',
          'Twenty-five minutes suits most chapters, but dense material may need shorter blocks. Start small enough that you never dread the first minute, then lengthen the session as it gets easy.',
          '### Ending well',
          'Stop at a natural pause, not in the middle of a thought. Jot down where you will resume, so tomorrow begins with a step instead of a search for the place.',
          'Over a week, the pattern matters more than any single session. Read at roughly the same time each day and let the habit carry the effort for you.',
        ],
      ],
      [
        'Chapter 3',
        'Remembering what you read',
        [
          'Memory prefers questions to highlights. After a section, close the book and say the main idea aloud.',
          'Turn each key point into a question you could answer next week, and review the questions after one day, three days and one week.',
          'Keep the source page next to every card so you can check it. A reliable habit is a small review, done often.',
          '### Spacing your reviews',
          'A card seen once is forgotten quickly; a card seen at growing intervals stays. Review the new ones tomorrow, the shaky ones in three days, and the solid ones next month.',
          '### Writing good questions',
          'Ask for one fact or one reason per card. If an answer needs a paragraph, split it. Questions that begin with why or how test understanding better than those that ask for a name.',
          'Be honest when you grade yourself. A card you almost knew belongs back in the next review, not in the pile of finished ones.',
        ],
      ],
    ],
  },
  vi: {
    title: 'Đọc tập trung',
    chapters: [
      [
        'Chương 1',
        'Vì sao sự chú ý là thứ khan hiếm',
        [
          'Đọc sách là cuộc trò chuyện giữa trang giấy và một cái đầu đang mệt. Phần lớn chúng ta mất tập trung trước khi mất hứng thú, và một kế hoạch rõ cho hai mươi phút tới giúp nhiều hơn ý chí.',
          'Hãy quyết định bạn cần gì từ chương này trước khi đọc. Lướt qua các đề mục trước, rồi quay lại những phần quan trọng. Buổi đọc ngắn có điểm kết thúc nhìn thấy được thì dễ bắt đầu hơn.',
          'Khi hết giờ, hãy viết một câu về điều bạn vừa học được. Câu đó là cách ôn tập rẻ nhất mà bạn có thể làm.',
          '### Trước khi bắt đầu',
          'Chọn một câu hỏi mà chương này cần trả lời và viết lên đầu trang giấy. Đọc để tìm câu trả lời biến một văn bản dài thành cuộc tìm kiếm, và cuộc tìm kiếm dễ theo đuổi hơn một nghĩa vụ.',
          'Dọn bàn, chỉ để lại cuốn sách và một cây bút. Nếu được, hãy để điện thoại ở phòng khác; một thông báo tốn nhiều hơn rất nhiều so với vài giây đọc nó.',
          '### Khi đầu óc đi lạc',
          'Đi lạc là chuyện bình thường, không phải thất bại. Hãy nhận ra, đánh dấu dòng đang đọc rồi quay lại mà không tự trách. Mỗi lần quay lại là một lần luyện kỹ năng bạn đang xây.',
        ],
      ],
      [
        'Chương 2',
        'Đọc theo từng phiên tập trung',
        [
          'Một phiên tập trung có điểm bắt đầu, mục tiêu và giờ nghỉ. Chọn một chương, đặt thời gian và tạm gác phần còn lại của cuốn sách.',
          'Hết phiên thì nghỉ thật: đứng dậy và nhìn ra xa. Năm phút nghỉ đền lại công sức của phiên tiếp theo.',
          'Ghi lặng lẽ số trang và số phút, đừng biến thành điểm phải vượt. Đều đặn quan trọng hơn một buổi tối nước rút.',
          '### Chọn độ dài phiên',
          'Hai mươi lăm phút hợp với phần lớn các chương, nhưng tài liệu dày đặc có thể cần phiên ngắn hơn. Bắt đầu đủ nhỏ để không ngại phút đầu tiên, rồi kéo dài dần khi đã quen.',
          '### Kết thúc cho tốt',
          'Dừng ở chỗ ngắt tự nhiên, đừng dừng giữa một ý. Ghi nhanh chỗ sẽ đọc tiếp, để ngày mai bắt đầu bằng một bước đi thay vì đi tìm lại vị trí.',
          'Trong một tuần, nhịp đều quan trọng hơn từng phiên riêng lẻ. Đọc vào khoảng cùng một giờ mỗi ngày và để thói quen gánh bớt công sức cho bạn.',
        ],
      ],
      [
        'Chương 3',
        'Nhớ điều đã đọc',
        [
          'Trí nhớ thích câu hỏi hơn là đoạn tô sáng. Đọc xong một mục, hãy gấp sách và nói to ý chính.',
          'Biến mỗi ý chính thành câu hỏi mà tuần sau bạn vẫn trả lời được, rồi ôn lại sau một ngày, ba ngày và một tuần.',
          'Giữ trang nguồn bên cạnh mỗi thẻ để có thể kiểm tra. Một thói quen đáng tin là ôn ít, ôn thường xuyên.',
          '### Giãn cách các lần ôn',
          'Thẻ chỉ xem một lần thì quên nhanh; thẻ xem với khoảng cách tăng dần thì ở lại. Ôn thẻ mới vào ngày mai, thẻ còn lung lay sau ba ngày, thẻ đã chắc vào tháng sau.',
          '### Viết câu hỏi tốt',
          'Mỗi thẻ chỉ hỏi một dữ kiện hoặc một lý do. Nếu câu trả lời cần cả đoạn văn, hãy tách ra. Câu hỏi bắt đầu bằng vì sao hay như thế nào kiểm tra hiểu biết tốt hơn câu hỏi chỉ đòi một cái tên.',
          'Chấm điểm cho chính mình thật thà. Thẻ bạn gần nhớ ra thì nên quay lại lần ôn sau, đừng bỏ vào chồng đã xong.',
        ],
      ],
    ],
  },
};

function docHtml(doc) {
  const body = doc.chapters
    .map(
      ([heading, subtitle, paragraphs], index) =>
        `<section style="page-break-before:${index === 0 ? 'auto' : 'always'}">
<h1>${heading}</h1><h2>${subtitle}</h2>${paragraphs.map((p) => (p.startsWith('### ') ? `<h3>${p.slice(4)}</h3>` : `<p>${p}</p>`)).join('')}</section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${doc.title}</title><style>
body{font-family:'Segoe UI',Arial,'DejaVu Sans',sans-serif;color:#1d1d1b;font-size:13pt;line-height:1.6;margin:0}
h1{font:700 30pt Arial,sans-serif;margin:0 0 6pt}h2{font:400 17pt Arial,sans-serif;color:#555;margin:0 0 22pt}
h3{font:700 15pt Arial,sans-serif;margin:18pt 0 8pt}p{margin:0 0 14pt}</style></head><body>${body}</body></html>`;
}

/** Tạo PDF có lớp chữ thật bằng chính Chromium (không cần file PDF bản quyền). */
async function makePdf(context, lang, dir) {
  const page = await context.newPage();
  await page.setContent(docHtml(DOCS[lang]));
  const path = join(dir, `demo-${lang}.pdf`);
  await page.pdf({
    path,
    format: 'Letter',
    margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
  });
  await page.close();
  return path;
}

const SETS = {
  en: {
    catalog: en,
    locale: 'en-US',
    query: 'focus',
    summary: {
      summary:
        'Attention runs out before interest does, so a short plan with a visible end beats willpower. Decide what you want from a chapter, skim its headings, then read in short sessions.',
      keyPoints: [
        { text: 'Most readers lose focus long before they lose interest.', pages: [1] },
        { text: 'A plan for the next twenty minutes helps more than willpower.', pages: [1] },
        { text: 'One sentence about what you learned is the cheapest review.', pages: [1] },
      ],
      terms: [
        {
          term: 'Visible end',
          definition: 'A session length you can see, which makes starting easier.',
        },
      ],
    },
  },
  vi: {
    catalog: vi,
    locale: 'vi-VN',
    query: 'tập trung',
    summary: {
      summary:
        'Sự chú ý cạn trước khi hứng thú cạn, nên một kế hoạch ngắn có điểm kết thúc rõ hiệu quả hơn ý chí. Hãy xác định mục tiêu của chương, lướt qua đề mục rồi đọc theo từng phiên ngắn.',
      keyPoints: [
        { text: 'Phần lớn người đọc mất tập trung trước khi mất hứng thú.', pages: [1] },
        { text: 'Kế hoạch cho hai mươi phút tới giúp nhiều hơn ý chí.', pages: [1] },
        { text: 'Một câu về điều đã học là cách ôn tập rẻ nhất.', pages: [1] },
      ],
      terms: [
        {
          term: 'Điểm kết thúc rõ',
          definition: 'Độ dài phiên nhìn thấy được, giúp việc bắt đầu dễ hơn.',
        },
      ],
    },
  },
};

function fakeCompletion(summary) {
  return {
    id: 'screenshot-demo',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: JSON.stringify(summary) },
      },
    ],
    usage: { prompt_tokens: 600, completion_tokens: 180, total_tokens: 780 },
  };
}

async function launch(lang, set) {
  const userDataDir = mkdtempSync(join(tmpdir(), `readfocus-shots-${lang}-`));
  // `channel: 'chromium'` dùng chế độ headless mới, cho phép nạp extension.
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: VIEWPORT,
    screenSize: VIEWPORT,
    deviceScaleFactor: 1,
    locale: set.locale,
    colorScheme: 'light',
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  return { context, userDataDir };
}

async function extensionId(context) {
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent('serviceworker', { timeout: 15000 });
  return new URL(worker.url()).host;
}

async function shoot(page, outDir, name) {
  // Chờ một nhịp để hiệu ứng chuyển cảnh kết thúc.
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `${name}.png`), type: 'png' });
  console.log(`  ${name}.png`);
}

/** Thu nhỏ tới khoảng 100% để thấy cả trang. */
async function zoomToHundred(page, t) {
  for (let i = 0; i < 10; i += 1) {
    const label = await page.locator('.toolbar__zoom').innerText();
    if (Number.parseInt(label.replace(/[^0-9]/g, ''), 10) <= 110) break;
    await page.getByRole('button', { name: t.zoomOut }).click();
  }
}

async function captureSet(lang) {
  const set = SETS[lang];
  const t = set.catalog;
  const outDir = join(root, 'store', 'screenshots', lang);
  mkdirSync(outDir, { recursive: true });

  const { context, userDataDir } = await launch(lang, set);
  try {
    // Server AI giả lập: chỉ để minh hoạ giao diện tóm tắt.
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    await context.route('http://localhost:11434/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify(fakeCompletion(set.summary)),
      });
    });
    // Quyền host tuỳ chọn không cấp được trong chế độ tự động; giả lập kết quả "đã cấp".
    await context.addInitScript(() => {
      try {
        Object.defineProperty(chrome.permissions, 'request', {
          value: async () => true,
          configurable: true,
        });
        Object.defineProperty(chrome.permissions, 'contains', {
          value: async () => true,
          configurable: true,
        });
      } catch {
        // Không phải trang extension.
      }
    });

    const id = await extensionId(context);
    const page = await context.newPage();
    const url = `chrome-extension://${id}/viewer.html`;

    // Ghi cấu hình AI từ service worker trước khi mở viewer, để viewer không ghi đè bằng mặc định.
    const worker = context.serviceWorkers()[0];
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        aiSettings: {
          providerId: 'openai-compatible',
          model: 'llama3.2',
          embedModel: '',
          baseUrl: 'http://localhost:11434/v1',
          saveKey: true,
          language: 'ui',
          consentGiven: true,
        },
      });
    });
    await page.goto(url);

    console.log(`[${lang}]`);

    // 1. Đọc + mục lục.
    await page
      .locator('input[type="file"]')
      .setInputFiles(await makePdf(context, lang, userDataDir));
    await page.getByRole('tab', { name: t.tocTitle }).waitFor();
    await page.waitForSelector('.toc, [class*="toc"]', { timeout: 20000 });
    await zoomToHundred(page, t);
    await page.waitForTimeout(1200);
    await shoot(page, outDir, '01-reading-toc');

    // 2. Tìm kiếm.
    await page.getByRole('tab', { name: t.searchTab }).click();
    const box = page.getByPlaceholder(t.searchPlaceholder);
    await box.fill(set.query);
    await page.waitForTimeout(1200);
    await shoot(page, outDir, '02-search');

    // 3. Tóm tắt (dữ liệu AI giả lập).
    await page.getByRole('tab', { name: t.summaryTab }).click();
    await page.getByRole('button', { name: t.summarizeCurrentSection }).click();
    await page.getByText(t.summaryKeyPointsTitle).waitFor({ timeout: 20000 });
    await shoot(page, outDir, '03-summary');

    // 4. Focus mode.
    await page.getByRole('tab', { name: t.focusTab }).click();
    await page.getByRole('button', { name: t.focusModeOn }).click();
    await page.mouse.move(640, 290);
    await page.waitForTimeout(600);
    await shoot(page, outDir, '04-focus-mode');
    await page.keyboard.press('Escape');

    // 5. OCR trên bản scan tiếng Việt tự tạo (cùng một file cho cả hai bộ ảnh).
    if (!skipOcr) {
      const scanned = join(fixtures, 'scanned-vi.pdf');
      if (!existsSync(scanned)) throw new Error('Thiếu scanned-vi.pdf: chạy npm run fixtures:scan');
      await page.locator('input[type="file"]').setInputFiles(scanned);
      await page.getByRole('button', { name: t.ocrStart }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: t.ocrStart }).click();
      await page.locator('.ocr-panel__report').waitFor({ timeout: 240000 });
      await page.getByRole('tab', { name: t.tocTitle }).click();
      await zoomToHundred(page, t);
      await page.waitForTimeout(2500);
      await shoot(page, outDir, '05-ocr');
    }
  } finally {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

if (!existsSync(join(dist, 'manifest.json'))) {
  throw new Error('Thiếu dist/: chạy npm run build trước.');
}
for (const lang of Object.keys(SETS)) {
  if (only && only !== lang) continue;
  await captureSet(lang);
}
