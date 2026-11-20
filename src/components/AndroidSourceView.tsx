import React, { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';

interface AndroidFileEntry {
  path: string;
  content: string;
}

export const AndroidSourceView: React.FC = () => {
  const [files, setFiles] = useState<AndroidFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/android-files')
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load Android source files');
        return res.json();
      })
      .then((data: { files: AndroidFileEntry[] }) => {
        if (!active) return;
        setFiles(data.files);
        const preferred =
          data.files.find((f) => f.path.endsWith('FieldDiagViewModel.kt')) ?? data.files[0];
        if (preferred) setSelectedPath(preferred.path);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load Android files');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeFile = files.find((f) => f.path === selectedPath);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#182019] text-balance">
            CropAnalyzer Native Android Project (Kotlin &amp; Jetpack Compose)
          </h1>
          <p className="mt-1 text-sm text-[#475449]">
            Full native Android implementation with CameraX bounding-box framing, Room SQLite memory, 30-crop Southeast Asian offline JSON asset, Wi-Fi-first ConnectivityManager routing, and Gemini cloud fallback.
          </p>
        </div>

        <a
          href="/api/android-project.zip"
          download="CropAnalyzer-Android.zip"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#1B5E20] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          Download Android ZIP
        </a>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#DCE2D7] bg-white p-8 text-sm text-[#5A675C]">
          Loading Android Studio project files...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-1.5 lg:col-span-4">
            {files.map((file) => {
              const selected = file.path === selectedPath;
              const shortName = file.path.split('/').pop() ?? file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-[#1B5E20] bg-[#EBF3EB] text-[#14532D]'
                      : 'border-[#E2E6DF] bg-white text-[#182019] hover:bg-[#F3F5F0]'
                  }`}
                >
                  <Smartphone className="h-4 w-4 shrink-0 text-[#5A675C]" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{shortName}</p>
                    <p className="truncate font-mono text-[11px] text-[#5A675C]">{file.path}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#DCE2D7] bg-[#161B17] text-[#E6EDE7] lg:col-span-8">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs">
              <span className="font-mono text-emerald-300">{activeFile?.path}</span>
              <span className="font-mono-tabular text-white/60">
                {activeFile ? `${activeFile.content.split('\n').length} lines` : ''}
              </span>
            </div>
            <pre className="max-h-[560px] overflow-auto p-4 font-mono text-xs leading-relaxed">
              <code>{activeFile?.content}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
