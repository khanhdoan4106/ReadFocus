import { describe, expect, it } from 'vitest';
import { DEFAULT_MODELS } from '../src/core/llm/models';
import {
  isLocalBaseUrl,
  LLM_HOST_ORIGINS,
  originPatternForUrl,
  providerDefaultBaseUrl,
  providerOriginPattern,
} from '../src/core/llm/permissions';
import {
  aiConfigProblem,
  defaultAiSettings,
  isProviderId,
  providerRequiresKey,
  sanitizeAiSettings,
} from '../src/core/llm/settings';

describe('sanitizeAiSettings', () => {
  it('giữ tuỳ chọn hợp lệ', () => {
    const settings = {
      providerId: 'gemini',
      model: 'gemini-test',
      embedModel: 'embed-test',
      baseUrl: 'https://gateway.example.com/v1',
      saveKey: false,
      language: 'document',
      consentGiven: true,
    };
    expect(sanitizeAiSettings(settings)).toEqual({
      ...settings,
      baseUrl: 'https://gateway.example.com/v1',
    });
  });

  it('cài đặt cũ không có embedModel thì để rỗng (dùng mặc định của provider)', () => {
    expect(sanitizeAiSettings({ providerId: 'openai', model: 'x' }).embedModel).toBe('');
    expect(sanitizeAiSettings({ embedModel: 42 }).embedModel).toBe('');
  });

  it('dữ liệu hỏng trả về mặc định', () => {
    expect(sanitizeAiSettings(null)).toEqual(defaultAiSettings());
    expect(sanitizeAiSettings('abc')).toEqual(defaultAiSettings());
    expect(sanitizeAiSettings({ providerId: 'khác' }).providerId).toBe('openai');
    expect(sanitizeAiSettings({ language: 'en' }).language).toBe('vi');
  });

  it('model rỗng dùng model mặc định của provider đã chọn', () => {
    const settings = sanitizeAiSettings({ providerId: 'anthropic', model: '   ' });
    expect(settings.model).toBe(DEFAULT_MODELS.anthropic);
  });

  it('bỏ khoảng trắng thừa ở model và base URL', () => {
    const settings = sanitizeAiSettings({
      providerId: 'openai-compatible',
      model: '  llama3.2  ',
      baseUrl: '  http://localhost:1234/v1  ',
    });
    expect(settings.model).toBe('llama3.2');
    expect(settings.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('mặc định lưu key và chưa xác nhận gửi dữ liệu', () => {
    const settings = defaultAiSettings();
    expect(settings.saveKey).toBe(true);
    expect(settings.consentGiven).toBe(false);
    expect(settings.model).toBe(DEFAULT_MODELS.openai);
  });

  it('chỉ nhận đúng bốn provider id', () => {
    expect(isProviderId('openai')).toBe(true);
    expect(isProviderId('gemini')).toBe(true);
    expect(isProviderId('anthropic')).toBe(true);
    expect(isProviderId('openai-compatible')).toBe(true);
    expect(isProviderId('openai ')).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
  });
});

describe('providerRequiresKey', () => {
  it('ba provider đám mây bắt buộc key, OpenAI-compatible thì không', () => {
    expect(providerRequiresKey('openai')).toBe(true);
    expect(providerRequiresKey('gemini')).toBe(true);
    expect(providerRequiresKey('anthropic')).toBe(true);
    expect(providerRequiresKey('openai-compatible')).toBe(false);
  });
});

describe('aiConfigProblem', () => {
  it('báo thiếu key với provider đám mây khi ô key trống', () => {
    const settings = { ...defaultAiSettings(), providerId: 'openai' as const };
    expect(aiConfigProblem(settings, '')).toBe('missing-key');
    expect(aiConfigProblem(settings, '   ')).toBe('missing-key');
    expect(aiConfigProblem(settings, 'sk-test')).toBeNull();
  });

  it('OpenAI-compatible chạy được khi không có key', () => {
    const settings = { ...defaultAiSettings(), providerId: 'openai-compatible' as const };
    expect(aiConfigProblem(settings, '')).toBeNull();
  });
});

describe('originPatternForUrl', () => {
  it('giữ scheme + hostname, bỏ đường dẫn và cổng', () => {
    expect(originPatternForUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
    expect(originPatternForUrl('http://localhost:11434/v1')).toBe('http://localhost/*');
    expect(originPatternForUrl('https://gateway.example.com/openai/v1/')).toBe(
      'https://gateway.example.com/*',
    );
  });

  it('từ chối URL hỏng hoặc giao thức khác', () => {
    expect(originPatternForUrl('')).toBeNull();
    expect(originPatternForUrl('không phải url')).toBeNull();
    expect(originPatternForUrl('ftp://example.com')).toBeNull();
    expect(originPatternForUrl('file:///tmp/a.pdf')).toBeNull();
  });
});

describe('providerOriginPattern', () => {
  it('dùng origin cố định cho ba provider đám mây', () => {
    expect(providerOriginPattern('openai')).toBe('https://api.openai.com/*');
    expect(providerOriginPattern('gemini')).toBe('https://generativelanguage.googleapis.com/*');
    expect(providerOriginPattern('anthropic')).toBe('https://api.anthropic.com/*');
  });

  it('theo base URL người dùng nhập với openai-compatible', () => {
    expect(providerOriginPattern('openai-compatible', 'http://127.0.0.1:1234/v1')).toBe(
      'http://127.0.0.1/*',
    );
    expect(providerOriginPattern('openai-compatible', 'https://llm.example.com/v1')).toBe(
      'https://llm.example.com/*',
    );
  });

  it('rơi về localhost khi base URL trống hoặc hỏng', () => {
    expect(providerOriginPattern('openai-compatible', '')).toBe('http://localhost/*');
    expect(providerOriginPattern('openai-compatible', 'not a url')).toBe('http://localhost/*');
  });

  it('danh sách quyền mặc định khớp đặc tả v1', () => {
    expect([...LLM_HOST_ORIGINS]).toEqual([
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.anthropic.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
  });
});

describe('providerDefaultBaseUrl', () => {
  it('trả đúng base URL từng provider', () => {
    expect(providerDefaultBaseUrl('openai')).toContain('api.openai.com');
    expect(providerDefaultBaseUrl('gemini')).toContain('generativelanguage.googleapis.com');
    expect(providerDefaultBaseUrl('anthropic')).toContain('api.anthropic.com');
    expect(providerDefaultBaseUrl('openai-compatible')).toBe('http://localhost:11434/v1');
  });
});

describe('isLocalBaseUrl', () => {
  it('nhận ra localhost và 127.0.0.1', () => {
    expect(isLocalBaseUrl('http://localhost:11434/v1')).toBe(true);
    expect(isLocalBaseUrl('http://127.0.0.1:1234/v1')).toBe(true);
    expect(isLocalBaseUrl('https://api.openai.com/v1')).toBe(false);
    expect(isLocalBaseUrl('hỏng')).toBe(false);
  });
});
