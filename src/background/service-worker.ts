import { isPdfUrl } from '../core/pdf-url';
import {
  buildViewerRedirect,
  PDF_REDIRECT_REGEX,
  PDF_REDIRECT_RULE_ID,
} from '../core/pdf-redirect';
import { vi } from '../i18n/vi';

const MENU_ID = 'readfocus-open';
const AUTO_OPEN_KEY = 'autoOpenPdf';
const PDF_ORIGINS = ['*://*/*'];

function openViewer(target?: string): void {
  const base = chrome.runtime.getURL('viewer.html');
  const url = target === undefined ? base : `${base}?url=${encodeURIComponent(target)}`;
  void chrome.tabs.create({ url });
}

function buildRedirectRule(): chrome.declarativeNetRequest.Rule {
  return {
    id: PDF_REDIRECT_RULE_ID,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        regexSubstitution: buildViewerRedirect(chrome.runtime.getURL('viewer.html')),
      },
    },
    condition: {
      regexFilter: PDF_REDIRECT_REGEX,
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  };
}

/**
 * Đọc trạng thái mong muốn từ storage, đối chiếu quyền host thực tế rồi thêm/gỡ
 * đúng một dynamic rule. Nếu người dùng đã thu hồi quyền thì tự đặt lại TẮT.
 */
async function syncAutoOpenPdfRule(): Promise<boolean> {
  const stored = await chrome.storage.sync.get(AUTO_OPEN_KEY);
  const wantsEnabled = stored[AUTO_OPEN_KEY] === true;
  const granted = await chrome.permissions.contains({ origins: PDF_ORIGINS });
  const enabled = wantsEnabled && granted;

  if (wantsEnabled && !granted) {
    await chrome.storage.sync.set({ [AUTO_OPEN_KEY]: false });
  }

  if (enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [PDF_REDIRECT_RULE_ID],
      addRules: [buildRedirectRule()],
    });
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [PDF_REDIRECT_RULE_ID],
    });
  }

  return enabled;
}

/**
 * Nhiều sự kiện có thể bắn cùng lúc (storage đổi, quyền đổi, tab gửi message),
 * nên xếp hàng để các lần cập nhật rule không chạy chồng lên nhau.
 */
let syncQueue: Promise<boolean> = Promise.resolve(false);

function scheduleAutoOpenSync(): Promise<boolean> {
  syncQueue = syncQueue.then(syncAutoOpenPdfRule, syncAutoOpenPdfRule);
  return syncQueue;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: vi.contextMenuOpen,
      contexts: ['page', 'link'],
    });
  });
  void scheduleAutoOpenSync();
});

chrome.runtime.onStartup.addListener(() => {
  void scheduleAutoOpenSync();
});

chrome.permissions.onAdded.addListener(() => {
  void scheduleAutoOpenSync();
});

chrome.permissions.onRemoved.addListener(() => {
  void scheduleAutoOpenSync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[AUTO_OPEN_KEY] !== undefined) {
    void scheduleAutoOpenSync();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) return false;
  if ((message as { type?: unknown }).type !== 'sync-auto-open-pdf') return false;

  void scheduleAutoOpenSync().then(
    (enabled) => sendResponse({ ok: true, enabled }),
    () => sendResponse({ ok: false, enabled: false }),
  );
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  openViewer(tab.url !== undefined && isPdfUrl(tab.url) ? tab.url : undefined);
});

chrome.contextMenus.onClicked.addListener((info) => {
  const target = info.linkUrl ?? info.pageUrl;
  openViewer(target !== undefined && isPdfUrl(target) ? target : undefined);
});
