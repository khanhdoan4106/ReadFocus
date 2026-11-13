import { compactClusters, type Cluster } from './normalize';

/** Đoạn `[from, to)` (offset ký tự trong văn bản của span) thuộc span thứ `span`. */
export type SpanSegment = { span: number; from: number; to: number };

type DomCluster = Cluster & { span: number };

/**
 * Ánh xạ khoảng ký tự `[start, end)` của văn bản trang đã trích sang các đoạn trong các span của
 * text layer. Văn bản trích và văn bản text layer chỉ khác nhau ở khoảng trắng (dấu cách, xuống
 * dòng) và dạng NFC/NFD, nên so khớp trên dãy ký tự đã bỏ khoảng trắng. Chữ lặp lại thì chọn chỗ
 * có thứ tự cụm ký tự gần nhất với vị trí cũ. Trả `null` khi offset ngoài phạm vi hoặc không tìm
 * thấy chữ đó trong các span (ánh xạ thất bại: không được đoán).
 */
export function mapRangeToSpans(
  spanTexts: readonly string[],
  pageText: string,
  start: number,
  end: number,
): SpanSegment[] | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end > pageText.length || end <= start) return null;

  const page = compactClusters(pageText);
  const first = page.findIndex((cluster) => cluster.start >= start);
  if (first === -1) return null;
  let last = first - 1;
  while (last + 1 < page.length && (page[last + 1] as Cluster).end <= end) last += 1;
  if (last < first) return null;
  const wanted = page
    .slice(first, last + 1)
    .map((cluster) => cluster.text)
    .join('');

  const dom: DomCluster[] = spanTexts.flatMap((text, span) =>
    compactClusters(text).map((cluster) => ({ ...cluster, span })),
  );
  // Chuỗi nối và bảng đổi vị trí ký tự → chỉ số cụm.
  const charToCluster: number[] = [];
  let joined = '';
  dom.forEach((cluster, index) => {
    for (let i = 0; i < cluster.text.length; i += 1) charToCluster.push(index);
    joined += cluster.text;
  });

  let best: { index: number; count: number; distance: number } | null = null;
  for (let at = joined.indexOf(wanted); at !== -1; at = joined.indexOf(wanted, at + 1)) {
    const startCluster = charToCluster[at] as number;
    const endCluster = charToCluster[at + wanted.length - 1] as number;
    // Phải khớp đúng biên cụm ký tự (không cắt giữa một cụm).
    const startsClean = at === 0 || charToCluster[at - 1] !== startCluster;
    const endsClean =
      at + wanted.length === joined.length || charToCluster[at + wanted.length] !== endCluster;
    if (!startsClean || !endsClean) continue;
    const distance = Math.abs(startCluster - first);
    if (best === null || distance < best.distance) {
      best = { index: startCluster, count: endCluster - startCluster + 1, distance };
    }
  }
  if (best === null) return null;

  const segments: SpanSegment[] = [];
  for (const cluster of dom.slice(best.index, best.index + best.count)) {
    const previous = segments[segments.length - 1];
    if (previous && previous.span === cluster.span) {
      previous.from = Math.min(previous.from, cluster.start);
      previous.to = Math.max(previous.to, cluster.end);
    } else {
      segments.push({ span: cluster.span, from: cluster.start, to: cluster.end });
    }
  }
  return segments;
}
