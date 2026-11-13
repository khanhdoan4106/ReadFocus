import { t } from '../i18n';
import type { ProgressSyncApi } from './hooks/useProgressSync';

/**
 * Thông báo "Trên máy khác bạn đã đọc tới trang X". Không bao giờ tự nhảy trang: chỉ nhảy khi
 * người dùng bấm "Đến trang X".
 */
export function SyncNoticeBar({ sync }: { sync: ProgressSyncApi }) {
  const notice = sync.notice;
  if (notice === null) return null;
  return (
    <div class="notice sync-notice" role="status">
      <span>{t.syncNotice(notice.page)}</span>
      <button type="button" class="notice__button" onClick={sync.goToNoticePage}>
        {t.syncNoticeGo(notice.page)}
      </button>
      <button type="button" class="notice__button" onClick={sync.dismissNotice}>
        {t.syncNoticeDismiss}
      </button>
    </div>
  );
}
