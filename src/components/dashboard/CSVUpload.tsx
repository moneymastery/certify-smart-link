import { useState, useCallback } from "react";
import Papa from "papaparse";
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

  const parseFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a .csv file");
        return;
      }
      setFileName(file.name);

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`CSV parse error: ${results.errors[0].message}`);
            return;
          }
          if (results.data.length === 0) {
            setError("CSV file is empty");
            return;
          }
          const headers = results.meta.fields || [];
          if (!headers.some((h) => h.toLowerCase().includes("name"))) {
            setError('CSV must have a column containing "name" (e.g. recipient_name, name, full_name)');
            return;
          }
          setRowCount(results.data.length);
          onDataParsed(headers, results.data);
        },
      });
    },
    [onDataParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
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
              <p className="text-sm font-medium text-foreground">
                Drop your CSV file here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Must include a "name" column. Other columns (email, course, date, etc.) are optional.
              </p>
            </div>
            <label>
              <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
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
