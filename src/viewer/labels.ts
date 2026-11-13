import type { DocKind } from '../core/profile';
import type { FocusTimer } from '../core/focus';
import { t } from '../i18n';
import { MAX_FILE_BYTES } from './pdf';

export type ErrorReason =
  'not-pdf' | 'too-large' | 'password' | 'invalid' | 'unknown' | 'render' | 'fetch' | 'file-url';

export function profileLabel(kind: DocKind): string {
  switch (kind) {
    case 'book':
      return t.profileBook;
    case 'paper':
      return t.profilePaper;
    case 'slides':
      return t.profileSlides;
    case 'unknown':
      return t.profileUnknown;
  }
}

export function timerModeLabel(mode: FocusTimer['mode']): string {
  switch (mode) {
    case 'chapter':
      return t.timerModeChapter;
    case 'focus':
      return t.timerModeFocus;
    case 'break':
      return t.timerModeBreak;
  }
}

export function errorMessage(reason: ErrorReason): string {
  switch (reason) {
    case 'not-pdf':
      return t.errorNotPdf;
    case 'too-large':
      return t.errorTooLarge(Math.round(MAX_FILE_BYTES / (1024 * 1024)));
    case 'password':
      return t.errorPassword;
    case 'invalid':
    case 'render':
      return t.errorInvalid;
    case 'fetch':
      return t.errorFetch;
    case 'file-url':
      return t.errorFileUrl;
    case 'unknown':
      return t.errorGeneric;
  }
}
