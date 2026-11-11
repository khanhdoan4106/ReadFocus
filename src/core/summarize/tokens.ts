export const VI_CHARS_PER_TOKEN = 3;
export const EN_CHARS_PER_TOKEN = 4;

const VIETNAMESE_PATTERN =
  /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/iu;

/** Nhận biết văn bản tiếng Việt qua các ký tự có dấu đặc trưng. */
export function looksVietnamese(text: string): boolean {
  return VIETNAMESE_PATTERN.test(text.normalize('NFC'));
}

/**
 * Ước lượng token để chọn ngân sách và chia đoạn. Tiếng Việt tốn khoảng 3 ký tự
 * mỗi token, tiếng Anh khoảng 4; đây là ước lượng, không phải tokenizer thật.
 */
export function estimateTokens(text: string): number {
  if (text === '') return 0;
  const charsPerToken = looksVietnamese(text) ? VI_CHARS_PER_TOKEN : EN_CHARS_PER_TOKEN;
  return Math.ceil(text.length / charsPerToken);
}
