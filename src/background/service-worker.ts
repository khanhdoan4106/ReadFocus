import { isPdfUrl } from '../core/pdf-url';
import { vi } from '../i18n/vi';

const MENU_ID = 'readfocus-open';

function openViewer(target?: string): void {
  const base = chrome.runtime.getURL('viewer.html');
  const url = target === undefined ? base : `${base}?url=${encodeURIComponent(target)}`;
  void chrome.tabs.create({ url });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: vi.contextMenuOpen,
      contexts: ['page', 'link'],
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  openViewer(tab.url !== undefined && isPdfUrl(tab.url) ? tab.url : undefined);
});

chrome.contextMenus.onClicked.addListener((info) => {
  const target = info.linkUrl ?? info.pageUrl;
  openViewer(target !== undefined && isPdfUrl(target) ? target : undefined);
});
