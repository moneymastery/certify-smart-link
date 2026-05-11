import { useState, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CSVUploadProps {
  onDataParsed: (headers: string[], rows: Record<string, string>[]) => void;
}

const CSVUpload = ({ onDataParsed }: CSVUploadProps) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const processRows = useCallback(
    (headers: string[], rows: Record<string, string>[]) => {
      if (rows.length === 0) {
        setError("File is empty or has no data rows");
        return;
      }
      if (!headers.some((h) => h.toLowerCase().includes("name"))) {
        setError('File must have a column containing "name" (e.g. recipient_name, name, full_name)');
        return;
      }
      setRowCount(rows.length);
      onDataParsed(headers, rows);
    },
    [onDataParsed],
  );

  const parseExcel = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true, cellNF: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          // Convert to raw 2D array — keep Date objects as-is via raw:true
          const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: true });

          // Find the first row where at least 3 non-empty cells exist and
          // it doesn't look like a merged title (most cells are empty/null)
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
            const row = rawRows[i];
            const nonEmpty = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== "").length;
            if (nonEmpty >= 3) {
              headerRowIdx = i;
              break;
            }
          }

          const headerRow = rawRows[headerRowIdx];
          const headers = headerRow
            .map((h: any) =>
              String(h ?? "")
                .replace(/[\r\n]+/g, " ")
                .trim(),
            )
            .filter((h: string) => h.length > 0);

          if (headers.length === 0) {
            setError("Could not find valid column headers in the spreadsheet.");
            return;
          }

          const dataRows = rawRows.slice(headerRowIdx + 1);
          const dateHeaderRe = /(date|dob|issued|expiry|valid|birth)/i;
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const fmtYMD = (y: number, m: number, d: number) =>
            `${String(d).padStart(2, "0")} ${months[m]} ${y}`;
          // XLSX with cellDates:true returns Date objects at UTC midnight of the
          // cell's calendar date. Use UTC components so the day doesn't shift in
          // negative-offset timezones (Americas) or positive ones (Asia).
          const fmtDate = (d: Date) => fmtYMD(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          const cellToString = (val: any, header: string): string => {
            if (val === null || val === undefined || val === "") return "";
            if (val instanceof Date) return fmtDate(val);
            if (typeof val === "number" && dateHeaderRe.test(header) && val > 20000 && val < 80000) {
              try {
                const parsed: any = (XLSX as any).SSF?.parse_date_code?.(val);
                if (parsed) return fmtYMD(parsed.y, parsed.m - 1, parsed.d);
              } catch {
                /* noop */
              }
            }
            // Handle pre-formatted date strings like "5/20/2026", "20-05-2026", "2026-05-20"
            const str = String(val).trim();
            if (dateHeaderRe.test(header)) {
              const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
              if (iso) return fmtYMD(+iso[1], +iso[2] - 1, +iso[3]);
              const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
              if (dmy) {
                let [, a, b, y] = dmy;
                let yr = +y; if (yr < 100) yr += 2000;
                // Ambiguous: assume DD/MM/YYYY when first part > 12, else MM/DD/YYYY
                const ai = +a, bi = +b;
                const day = ai > 12 ? ai : bi > 12 ? bi : ai; // prefer DMY for non-US
                const mon = ai > 12 ? bi : bi > 12 ? ai : bi;
                if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return fmtYMD(yr, mon - 1, day);
              }
            }
            return str;
          };
          const rows: Record<string, string>[] = [];
          for (const row of dataRows) {
            // Skip completely empty rows
            const nonEmpty = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== "").length;
            if (nonEmpty === 0) continue;
            const cleaned: Record<string, string> = {};
            for (let ci = 0; ci < headers.length; ci++) {
              cleaned[headers[ci]] = cellToString(row[ci], headers[ci]);
            }
            rows.push(cleaned);
          }

          processRows(headers, rows);
        } catch {
          setError("Failed to parse spreadsheet. Please check the file format.");
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [processRows],
  );

  const parseCSV = useCallback(
    (file: File) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          const fatalErrors = results.errors.filter((e) => e.type !== "FieldMismatch");
          if (fatalErrors.length > 0) {
            setError(`CSV parse error: ${fatalErrors[0].message}`);
            return;
          }
          const headers = results.meta.fields || [];
          processRows(headers, results.data);
        },
      });
    },
    [processRows],
  );

  const parseFile = useCallback(
    (file: File) => {
      setError(null);
      const ext = file.name.split(".").pop()?.toLowerCase();
      const isExcel = ext === "xlsx" || ext === "xls" || ext === "ods";
      const isCsv = ext === "csv";

      if (!isExcel && !isCsv) {
        setError("Please upload a .csv, .xlsx, or .xls file");
        return;
      }

      setFileName(file.name);

      if (isExcel) {
        parseExcel(file);
      } else {
        parseCSV(file);
      }
    },
    [parseExcel, parseCSV],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent/5"
            : fileName
              ? "border-accent/40 bg-accent/5"
              : "border-border bg-muted/30"
        }`}
      >
        {fileName ? (
          <div className="space-y-2">
            <CheckCircle className="h-8 w-8 text-accent mx-auto" />
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">{rowCount} recipients found</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Drop your file here</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports CSV, XLSX, and XLS. Must include a "name" column.
              </p>
            </div>
            <label>
              <input type="file" accept=".csv,.xlsx,.xls,.ods" onChange={handleFileInput} className="hidden" />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <FileText className="h-4 w-4" />
                  Browse Files
                </span>
              </Button>
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};

export default CSVUpload;
