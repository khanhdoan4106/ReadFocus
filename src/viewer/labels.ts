import type { DocKind } from '../core/profile';
import type { FocusTimer } from '../core/focus';
import { vi } from '../i18n/vi';
import { MAX_FILE_BYTES } from './pdf';

export type ErrorReason =
  'not-pdf' | 'too-large' | 'password' | 'invalid' | 'unknown' | 'render' | 'fetch' | 'file-url';

export function profileLabel(kind: DocKind): string {
  switch (kind) {
    case 'book':
      return vi.profileBook;
    case 'paper':
      return vi.profilePaper;
    case 'slides':
      return vi.profileSlides;
    case 'unknown':
      return vi.profileUnknown;
  }
}

export function timerModeLabel(mode: FocusTimer['mode']): string {
  switch (mode) {
    case 'chapter':
      return vi.timerModeChapter;
    case 'focus':
      return vi.timerModeFocus;
    case 'break':
      return vi.timerModeBreak;
  }
}

export function errorMessage(reason: ErrorReason): string {
  switch (reason) {
    case 'not-pdf':
      return vi.errorNotPdf;
    case 'too-large':
      return vi.errorTooLarge(Math.round(MAX_FILE_BYTES / (1024 * 1024)));
    case 'password':
      return vi.errorPassword;
    case 'invalid':
    case 'render':
      return vi.errorInvalid;
    case 'fetch':
      return vi.errorFetch;
    case 'file-url':
      return vi.errorFileUrl;
    case 'unknown':
      return vi.errorGeneric;
  }
}
