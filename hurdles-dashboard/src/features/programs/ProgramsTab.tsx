import { useRef, useState, useCallback, useEffect } from "react";
import { FileText, Sheet, FileCode, Upload, X, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { usePrograms } from "./usePrograms";
import type { Program, ProgramFileType } from "../../lib/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function detectFileType(file: File): ProgramFileType | null {
  const mime = file.type;
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "xlsx") return "xlsx";
  if (ext === "docx") return "docx";
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const fileTypeIcon: Record<ProgramFileType, JSX.Element> = {
  pdf:  <FileText  className="w-5 h-5 text-red-500"     aria-hidden />,
  xlsx: <Sheet     className="w-5 h-5 text-emerald-500" aria-hidden />,
  docx: <FileCode  className="w-5 h-5 text-blue-500"    aria-hidden />,
};

const fileTypeBadge: Record<ProgramFileType, string> = {
  pdf:  "bg-red-50 text-red-700",
  xlsx: "bg-emerald-50 text-emerald-700",
  docx: "bg-blue-50 text-blue-700",
};

// ─── Viewer ──────────────────────────────────────────────────────────────────

interface ViewerProps {
  program: Program;
  onClose: () => void;
  getSignedUrl: (path: string) => Promise<string>;
}

function ProgramViewer({ program, onClose, getSignedUrl }: ViewerProps) {
  const [busy, setBusy] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [xlsxHtml, setXlsxHtml] = useState<string | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const render = useCallback(async () => {
    setBusy(true);
    setViewError(null);
    try {
      const signedUrl = await getSignedUrl(program.file_path);
      setDownloadUrl(signedUrl);

      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error("Failed to fetch file");
      const buffer = await res.arrayBuffer();

      if (program.file_type === "xlsx") {
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        setXlsxHtml(XLSX.utils.sheet_to_html(sheet));
      } else if (program.file_type === "docx") {
        const { renderAsync } = await import("docx-preview");
        if (docxRef.current) {
          docxRef.current.innerHTML = "";
          await renderAsync(buffer, docxRef.current, undefined, {
            className: "docx-preview",
            inWrapper: false,
            ignoreWidth: true,
          });
        }
      } else if (program.file_type === "pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (pdfRef.current) {
          pdfRef.current.innerHTML = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = "block mb-2 w-full";
            pdfRef.current.appendChild(canvas);
            await page.render({
              canvasContext: canvas.getContext("2d")!,
              viewport,
              canvas,
            }).promise;
          }
        }
      }
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setBusy(false);
    }
  }, [program, getSignedUrl]);

  useEffect(() => { render(); }, [render]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {fileTypeIcon[program.file_type]}
            <span className="font-semibold text-slate-900 truncate">{program.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${fileTypeBadge[program.file_type]}`}>
              {program.file_type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {busy && (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}
          {viewError && (
            <p className="text-sm text-red-600 py-10 text-center">{viewError}</p>
          )}
          {!busy && !viewError && program.file_type === "xlsx" && xlsxHtml && (
            <div
              className="overflow-auto text-xs [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-50"
              dangerouslySetInnerHTML={{ __html: xlsxHtml }}
            />
          )}
          {!busy && !viewError && program.file_type === "docx" && (
            <div ref={docxRef} className="overflow-auto p-2 bg-white" />
          )}
          {!busy && !viewError && program.file_type === "pdf" && (
            <div ref={pdfRef} className="overflow-auto" />
          )}
        </div>

        {/* Footer */}
        {downloadUrl && !busy && (
          <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex justify-end">
            <a
              href={downloadUrl}
              download={program.name}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export default function ProgramsTab() {
  const { programs, loading, error, upload, getSignedUrl, remove } = usePrograms();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<Program | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function selectFile(file: File) {
    setUploadError(null);
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File must be under 20 MB.");
      return;
    }
    if (!detectFileType(file)) {
      setUploadError("Only .pdf, .xlsx, and .docx files are supported.");
      return;
    }
    setPendingFile(file);
    setDisplayName(file.name.replace(/\.[^.]+$/, ""));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }

  async function handleUpload() {
    if (!pendingFile) return;
    const fileType = detectFileType(pendingFile);
    if (!fileType) return;
    const name = displayName.trim() || pendingFile.name;
    setUploadBusy(true);
    setUploadError(null);
    try {
      await upload(pendingFile, name, fileType);
      setPendingFile(null);
      setDisplayName("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleDelete(program: Program) {
    if (!confirm(`Delete "${program.name}"?`)) return;
    setDeletingId(program.id);
    setDeleteError(null);
    try {
      await remove(program);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Training Programs</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload and view your training programs (PDF, XLSX, DOCX)</p>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className={[
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none",
            dragOver
              ? "border-sky-500 bg-sky-50"
              : pendingFile
              ? "border-slate-400 bg-slate-50"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
          ].join(" ")}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          {pendingFile ? (
            <div>
              <p className="text-sm font-medium text-slate-700">{pendingFile.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{formatBytes(pendingFile.size)}</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-slate-600">Drop a file here or click to browse</p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, XLSX, or DOCX · max 20 MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); e.target.value = ""; }}
        />

        {pendingFile && (
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploadBusy}
              className="rounded-md bg-slate-900 text-white py-2 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {uploadBusy ? "Uploading…" : "Upload"}
            </button>
            <button
              onClick={() => { setPendingFile(null); setDisplayName(""); setUploadError(null); }}
              className="rounded-md border border-slate-200 text-slate-500 py-2 px-3 text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      </div>

      {/* Program list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Uploaded Programs</h2>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : programs.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No programs uploaded yet.</p>
        ) : (
          <ul>
            {programs.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 py-3 border-t border-slate-100 first:border-t-0"
              >
                <div className="shrink-0">{fileTypeIcon[p.file_type as ProgramFileType]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(p.file_size)} · {formatDate(p.uploaded_at)}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium uppercase ${fileTypeBadge[p.file_type as ProgramFileType]}`}>
                  {p.file_type}
                </span>
                <button
                  onClick={() => setViewing(p)}
                  className="shrink-0 rounded-md border border-slate-200 text-slate-600 py-1 px-3 text-xs hover:bg-slate-50 transition-colors"
                >
                  View
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deletingId === p.id}
                  className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  {deletingId === p.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Viewer modal */}
      {viewing && (
        <ProgramViewer
          program={viewing}
          onClose={() => setViewing(null)}
          getSignedUrl={getSignedUrl}
        />
      )}
    </div>
  );
}
