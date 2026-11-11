import { readDdhWorkbookPreview } from './ddhWorkbookPreview';
import type { WorkbookPreview } from './ddhWorkbookPreview';

export type WorkbookPreviewResult =
    | { ok: true; preview: WorkbookPreview }
    | { ok: false };

self.onmessage = async ({ data: file }: MessageEvent<File>) => {
    let result: WorkbookPreviewResult;
    try {
        const preview = readDdhWorkbookPreview(await file.arrayBuffer());
        result = preview.size ? { ok: true, preview } : { ok: false };
    } catch {
        result = { ok: false };
    }
    self.postMessage(result);
};
