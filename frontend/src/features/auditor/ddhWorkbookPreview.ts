import * as XLSX from 'xlsx';
import { HEADER_SCAN_ROWS } from '../../utils/excelMapper';

export type WorkbookPreview = Map<string, unknown[][]>;

export function readDdhWorkbookPreview(data: ArrayBuffer): WorkbookPreview {
    const options: XLSX.ParsingOptions = { type: 'array', sheetRows: HEADER_SCAN_ROWS };
    const workbook = XLSX.read(data, options);
    const preview: WorkbookPreview = new Map();

    for (const name of workbook.SheetNames) {
        let sheet = workbook.Sheets[name];
        // SheetJS limits absolute row numbers. Keep the existing scan window
        // relative to the first used row when the sheet starts below row 1.
        if (sheet?.['!fullref']) {
            const fullRange = XLSX.utils.decode_range(sheet['!fullref']);
            const end = Math.min(fullRange.e.r + 1, fullRange.s.r + HEADER_SCAN_ROWS);
            if (end > HEADER_SCAN_ROWS) {
                sheet = XLSX.read(data, { ...options, sheets: [name], sheetRows: end }).Sheets[name];
            }
        }

        const ref = sheet?.['!ref'];
        if (!ref) {
            preview.set(name, []);
            continue;
        }

        const range = XLSX.utils.decode_range(ref);
        range.e.r = Math.min(range.e.r, range.s.r + HEADER_SCAN_ROWS - 1);
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1, defval: null, range,
        });
        preview.set(name, rows);
    }

    return preview;
}
