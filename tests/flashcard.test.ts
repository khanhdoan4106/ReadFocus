import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCardsForSection, parseCards } from '../src/core/flashcard/ai';
import { ankiTag, cardsToAnkiCsv, csvField } from '../src/core/flashcard/csv';
import {
  BLANK,
  clozeFromSentence,
  draftsFromSummary,
  freshCards,
  pickBlankWord,
} from '../src/core/flashcard/from-summary';
import {
  addDays,
  boxCounts,
  dueCards,
  reviewCard,
  sanitizeCard,
} from '../src/core/flashcard/leitner';
import type { Card } from '../src/core/flashcard/types';
import type { LLMProvider } from '../src/core/llm/types';
import type { SummaryRecord } from '../src/core/summarize/record';
import {
  _resetDbForTest,
  clearAllData,
  clearFlashcardsForDoc,
  deleteDocumentData,
  deleteFlashcard,
  loadFlashcards,
  saveFlashcards,
} from '../src/storage/db';

const card = (over: Partial<Card> = {}): Card => ({
  id: 'c1',
  docId: 'd',
  front: 'f',
  back: 'b',
  page: 1,
  source: 'summary',
  box: 1,
  dueDate: '2026-11-12',
  createdAt: 1,
  ...over,
});

describe('Leitner', () => {
  it('addDays qua tháng, năm và năm nhuận', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-12', 16)).toBe('2026-11-28');
    expect(addDays('2026-11-12', 0)).toBe('2026-11-12');
  });

  it('nhớ thì lên hộp và lịch giãn dần 1, 2, 4, 8, 16 ngày; hộp 5 giữ nguyên', () => {
    let current = card({ box: 1 });
    const days: number[] = [];
    const boxes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      current = reviewCard(current, true, '2026-11-12', 99);
      boxes.push(current.box);
      days.push(Number(current.dueDate.slice(8)) - 12);
    }
    expect(boxes).toEqual([2, 3, 4, 5, 5]);
    expect(days).toEqual([2, 4, 8, 16, 16]);
    expect(current.lastReviewedAt).toBe(99);
  });

  it('chưa nhớ thì về hộp 1 và ôn lại ngày mai', () => {
    const result = reviewCard(card({ box: 4 }), false, '2026-11-12', 5);
    expect(result.box).toBe(1);
    expect(result.dueDate).toBe('2026-11-13');
  });

  it('dueCards gồm thẻ đến hạn và quá hạn, hộp thấp trước, bỏ thẻ chưa đến hạn', () => {
    const cards = [
      card({ id: 'a', box: 3, dueDate: '2026-11-12' }),
      card({ id: 'b', box: 1, dueDate: '2026-11-10' }),
      card({ id: 'c', box: 1, dueDate: '2026-11-13' }),
      card({ id: 'd', box: 2, dueDate: '2026-11-01' }),
    ];
    expect(dueCards(cards, '2026-11-12').map((c) => c.id)).toEqual(['b', 'd', 'a']);
  });

  it('boxCounts đếm theo hộp', () => {
    expect(boxCounts([card({ box: 1 }), card({ box: 1 }), card({ box: 5 })])).toEqual({
      1: 2,
      2: 0,
      3: 0,
      4: 0,
      5: 1,
    });
  });

  it('sanitizeCard bỏ bản ghi hỏng và sửa hộp lạ về 1', () => {
    expect(sanitizeCard(null)).toBeNull();
    expect(sanitizeCard({ ...card(), front: ' ' })).toBeNull();
    expect(sanitizeCard({ ...card(), page: 0 })).toBeNull();
    expect(sanitizeCard({ ...card(), dueDate: 'mai' })).toBeNull();
    expect(sanitizeCard({ ...card(), box: 9 })?.box).toBe(1);
  });
});

describe('thẻ từ cache tóm tắt', () => {
  const summary: SummaryRecord = {
    id: 's',
    docId: 'd',
    startPage: 3,
    endPage: 6,
    title: 'Chương',
    providerId: 'openai',
    model: 'm',
    promptVersion: 1,
    language: 'vi',
    summary: 'Tóm tắt',
    keyPoints: [
      { text: 'Phương pháp Bayes cập nhật xác suất theo bằng chứng mới.', pages: [5] },
      { text: 'Ngắn gọn ok.', pages: [4] },
      { text: 'Giả thuyết ban đầu ảnh hưởng kết quả cuối cùng.', pages: [99] },
      {
        text: 'Chương này nói về những điều rất quan trọng nhưng không có thuật ngữ nào.',
        pages: [4],
      },
    ],
    terms: [
      { term: 'Xác suất', definition: 'Mức độ chắc chắn của một sự kiện.' },
      { term: 'Giả thuyết', definition: 'Điều được giả định là đúng khi bắt đầu.' },
      { term: ' ', definition: 'bỏ' },
    ],
    createdAt: 1,
  };

  it('pickBlankWord lấy từ dài nhất; câu toàn từ ngắn thì không có', () => {
    expect(pickBlankWord('Bayes cập nhật xác suất')).toBe('Bayes');
    expect(pickBlankWord('một hai ba bốn')).toBeNull();
  });

  it('cloze: ưu tiên che thuật ngữ nhiều âm tiết của tóm tắt, mặt sau có thuật ngữ và câu đầy đủ', () => {
    const cloze = clozeFromSentence('Thói quen buổi sáng giúp tăng năng suất.', ['năng suất']);
    expect(cloze?.front).toBe(`Thói quen buổi sáng giúp tăng ${BLANK}.`);
    expect(cloze?.back).toBe('năng suất\n\nThói quen buổi sáng giúp tăng năng suất.');
  });

  it('cloze: chọn thuật ngữ dài nhất khi nhiều thuật ngữ cùng khớp', () => {
    const cloze = clozeFromSentence('Phương pháp Bayes cập nhật xác suất có điều kiện.', [
      'xác suất',
      'xác suất có điều kiện',
      'Bayes',
    ]);
    expect(cloze?.front).toBe(`Phương pháp Bayes cập nhật ${BLANK}.`);
    expect(cloze?.back.startsWith('xác suất có điều kiện\n\n')).toBe(true);
  });

  it('cloze: so khớp không phân biệt hoa thường và chuẩn hoá NFC, giữ chữ gốc ở đáp án', () => {
    const nfd = 'Năng Suất'.normalize('NFD');
    const cloze = clozeFromSentence('Thói quen giúp tăng năng suất làm việc.', [nfd]);
    expect(cloze?.front).toBe(`Thói quen giúp tăng ${BLANK} làm việc.`);
    expect(cloze?.back.startsWith('năng suất\n\n')).toBe(true);
  });

  it('cloze: câu tiếng Việt không có thuật ngữ khớp thì không tạo thẻ', () => {
    expect(clozeFromSentence('Thói quen buổi sáng giúp tăng năng suất.', [])).toBeNull();
    expect(
      clozeFromSentence('Thói quen buổi sáng giúp tăng năng suất.', ['trí nhớ', 'giấc ngủ']),
    ).toBeNull();
  });

  it('cloze: thuật ngữ xuất hiện hai lần thì chỉ che lần đầu', () => {
    const cloze = clozeFromSentence('Năng suất tăng khi nghỉ ngơi, vì năng suất cần sức khoẻ.', [
      'năng suất',
    ]);
    expect(cloze?.front).toBe(`${BLANK} tăng khi nghỉ ngơi, vì năng suất cần sức khoẻ.`);
  });

  it('cloze: thuật ngữ trùng một phần với từ khác thì không che nhầm', () => {
    // "ai" chỉ nằm bên trong "hai": không phải một từ nguyên vẹn nên không được che.
    expect(clozeFromSentence('Hai người cùng làm việc.', ['ai'])).toBeNull();
    // Có cả "hai" và "ai" thì che đúng "ai", không che phần cuối của "Hai".
    const cloze = clozeFromSentence('Hai người hỏi ai đó.', ['ai']);
    expect(cloze?.front).toBe(`Hai người hỏi ${BLANK} đó.`);
    expect(cloze?.back.startsWith('ai' + String.fromCharCode(10, 10))).toBe(true);
    // Cụm nhiều từ chỉ khớp nguyên cụm: "năng suất" không khớp trong "năng suấtx".
    expect(clozeFromSentence('Chỉ số năng suấtx tăng lên.', ['năng suất'])).toBeNull();
  });

  it('cloze: câu tiếng Anh dùng từ nguyên vẹn dài nhất khi không có thuật ngữ', () => {
    const cloze = clozeFromSentence('Bayes updates probability with new evidence.');
    expect(cloze?.front).toBe(`Bayes updates ${BLANK} with new evidence.`);
    expect(cloze?.back).toBe('probability\n\nBayes updates probability with new evidence.');
  });

  it('cloze: tiếng Anh chỉ thay đúng từ nguyên vẹn, không thay chuỗi con', () => {
    // Lần xuất hiện đầu của "analysis" dính liền "x2" nên không phải từ nguyên vẹn.
    const cloze = clozeFromSentence('The x2analysis and analysis differ.');
    expect(cloze?.front).toBe(`The x2analysis and ${BLANK} differ.`);
  });

  it('cloze: tiếng Anh có thuật ngữ khớp thì ưu tiên thuật ngữ', () => {
    const cloze = clozeFromSentence('Bayes updates probability with new evidence.', [
      'new evidence',
    ]);
    expect(cloze?.front).toBe(`Bayes updates probability with ${BLANK}.`);
  });

  it('thuật ngữ → định nghĩa, ý chính → cloze theo thuật ngữ, mỗi thẻ có trang trong mục', () => {
    const drafts = draftsFromSummary(summary);
    // 2 thẻ thuật ngữ + 2 thẻ cloze; câu ngắn và câu tiếng Việt không có thuật ngữ bị bỏ.
    expect(drafts).toHaveLength(4);
    expect(drafts[0]).toMatchObject({ front: 'Xác suất', page: 3, source: 'summary' });
    expect(drafts[2]).toMatchObject({ page: 5 });
    expect(drafts[2]?.front).toBe(`Phương pháp Bayes cập nhật ${BLANK} theo bằng chứng mới.`);
    // Trang ngoài mục (99) thì rơi về trang đầu mục.
    expect(drafts[3]).toMatchObject({ page: 3 });
    expect(drafts[3]?.front).toBe(`${BLANK} ban đầu ảnh hưởng kết quả cuối cùng.`);
    expect(drafts.every((d) => d.page >= 3 && d.page <= 6)).toBe(true);
  });

  it('tạo lại không nhân đôi thẻ và không đụng tiến độ của thẻ cũ', () => {
    const first = freshCards('d', draftsFromSummary(summary), [], '2026-11-12', 1);
    const reviewed = first.map((c) => reviewCard(c, true, '2026-11-12', 2));
    const again = freshCards('d', draftsFromSummary(summary), reviewed, '2026-11-20', 3);
    expect(again).toEqual([]);
    expect(first.every((c) => c.box === 1 && c.dueDate === '2026-11-12')).toBe(true);
  });
});

describe('thẻ bằng AI', () => {
  const range = { startPage: 3, endPage: 6 };

  it('parse JSON, bỏ thẻ thiếu chữ, trang ngoài mục rơi về đầu mục, giới hạn số thẻ', () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        cards: [
          { front: 'Q1', back: 'A1', page: 4 },
          { front: 'Q2', back: 'A2', page: 50 },
          { front: '', back: 'A3', page: 4 },
          { front: 'Q4', back: 'A4' },
          'rác',
        ],
      }) +
      '\n```';
    expect(parseCards(raw, range)).toEqual([
      { front: 'Q1', back: 'A1', page: 4, source: 'ai' },
      { front: 'Q2', back: 'A2', page: 3, source: 'ai' },
      { front: 'Q4', back: 'A4', page: 3, source: 'ai' },
    ]);
    const many = JSON.stringify({
      cards: Array.from({ length: 50 }, (_, i) => ({ front: `q${i}`, back: `a${i}`, page: 3 })),
    });
    expect(parseCards(many, range)).toHaveLength(20);
    expect(parseCards('không phải json', range)).toEqual([]);
    expect(parseCards('{"cards": 3}', range)).toEqual([]);
  });

  function provider(reply: string) {
    const complete = vi.fn(async () => reply);
    const p: LLMProvider = {
      id: 'openai',
      label: 'OpenAI',
      defaultModel: 'm',
      defaultBaseUrl: 'x',
      complete,
      checkConnection: async () => {},
    };
    return { p, complete };
  }

  const input = (p: LLMProvider, signal = new AbortController().signal) => ({
    provider: p,
    config: { apiKey: 'k' },
    model: 'm',
    title: 'Chương',
    ...range,
    pages: [{ page: 3, text: 'Nội dung trang ba' }],
    signal,
  });

  it('một mục một request; prompt gắn nhãn trang và coi văn bản là dữ liệu', async () => {
    const { p, complete } = provider('{"cards":[{"front":"Q","back":"A","page":3}]}');
    const result = await generateCardsForSection(input(p));
    expect(result).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(1);
    const request = (complete.mock.calls as unknown as unknown[][])[0]?.[0] as {
      system: string;
      prompt: string;
    };
    expect(request.prompt).toContain('[Trang 3]\nNội dung trang ba');
    expect(request.system).toMatch(/untrusted/);
  });

  it('mục không có chữ thì không gọi mạng; huỷ trong lúc chờ thì không trả thẻ', async () => {
    const empty = provider('{}');
    expect(
      await generateCardsForSection({ ...input(empty.p), pages: [{ page: 3, text: '  ' }] }),
    ).toEqual([]);
    expect(empty.complete).not.toHaveBeenCalled();

    const controller = new AbortController();
    const live = provider('');
    live.complete.mockImplementation(async () => {
      controller.abort();
      return '{"cards":[{"front":"Q","back":"A","page":3}]}';
    });
    expect(await generateCardsForSection(input(live.p, controller.signal))).toEqual([]);
  });
});

describe('xuất CSV Anki', () => {
  it('escape dấu phẩy, ngoặc kép và xuống dòng', () => {
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('nói "xin chào"')).toBe('"nói ""xin chào"""');
    expect(csvField('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"');
  });

  it('tag là tên tài liệu và trang, không có khoảng trắng', () => {
    expect(ankiTag('Giáo trình Xác suất.pdf')).toBe('Giáo_trình_Xác_suất');
    expect(ankiTag('  .pdf')).toBe('ReadFocus');
  });

  it('có chỉ thị Anki và mỗi thẻ một bản ghi 3 cột', () => {
    const csv = cardsToAnkiCsv(
      [card({ front: 'Q, "1"', back: 'A\nB', page: 7 }), card({ id: 'c2', page: 2 })],
      'Sách hay.pdf',
    );
    expect(csv).toBe(
      '#separator:comma\n#html:false\n#tags column:3\n' +
        '"Q, ""1""","A\nB","Sách_hay trang_7"\n' +
        '"f","b","Sách_hay trang_2"\n',
    );
  });
});

describe('lưu thẻ', () => {
  beforeEach(async () => {
    _resetDbForTest();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('readfocus');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    _resetDbForTest();
  });

  it('lưu, cập nhật tiến độ, đọc theo tài liệu, xoá từng thẻ và cả tài liệu', async () => {
    await saveFlashcards([
      card({ id: 'a' }),
      card({ id: 'b', createdAt: 2 }),
      card({ id: 'x', docId: 'd2' }),
    ]);
    expect((await loadFlashcards('d')).map((c) => c.id)).toEqual(['a', 'b']);

    await saveFlashcards([reviewCard(card({ id: 'a' }), true, '2026-11-12', 5)]);
    expect((await loadFlashcards('d'))[0]?.box).toBe(2);

    await deleteFlashcard('a');
    expect((await loadFlashcards('d')).map((c) => c.id)).toEqual(['b']);

    await clearFlashcardsForDoc('d');
    expect(await loadFlashcards('d')).toEqual([]);
    expect(await loadFlashcards('d2')).toHaveLength(1);
  });

  it('xoá dữ liệu tài liệu và xoá toàn bộ cũng xoá thẻ', async () => {
    await saveFlashcards([card({ id: 'a' }), card({ id: 'x', docId: 'd2' })]);
    await deleteDocumentData('d');
    expect(await loadFlashcards('d')).toEqual([]);
    expect(await loadFlashcards('d2')).toHaveLength(1);
    await clearAllData();
    expect(await loadFlashcards('d2')).toEqual([]);
  });
});
