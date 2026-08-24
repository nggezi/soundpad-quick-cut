import { memo } from "react";
import type { ExportFormat } from "../../shared/types.js";
import { IconDownload, IconFolder, IconSoundpad } from "./Icons.js";

export const CATEGORIES = ["Quick Cut", "Voice", "FX", "Music", "Ambient"] as const;
export type Category = (typeof CATEGORIES)[number];

interface Props {
  soundName: string;
  soundNamePlaceholder: string;
  category: Category;
  format: ExportFormat;
  exporting: boolean;
  progress: number;
  waveformLoading: boolean;
  canExport: boolean;
  onCategoryChange: (c: Category) => void;
  onFormatChange: (f: ExportFormat) => void;
  onSoundNameChange: (name: string) => void;
  onExportToSoundpad: () => void;
  onExportFile: () => void;
}

export const ExportBar = memo(function ExportBar({
  soundName,
  soundNamePlaceholder,
  category,
  format,
  exporting,
  progress,
  waveformLoading,
  canExport,
  onCategoryChange,
  onFormatChange,
  onSoundNameChange,
  onExportToSoundpad,
  onExportFile,
}: Props) {
  return (
    <div className="export-bar">
      <div className="export-options">
        <label className="export-field export-name">
          <span className="export-field-label">命名</span>
          <input
            value={soundName}
            onChange={(e) => onSoundNameChange(e.target.value)}
            placeholder={soundNamePlaceholder || "片段名称"}
            maxLength={40}
            spellCheck={false}
          />
        </label>
        <label className="export-field">
          <span className="export-field-label">分类</span>
          <select value={category} onChange={(e) => onCategoryChange(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="export-field">
          <span className="export-field-label">格式</span>
          <select value={format} onChange={(e) => onFormatChange(e.target.value as ExportFormat)}>
            <option value="wav">WAV 无损</option>
            <option value="mp3">MP3 192kbps</option>
          </select>
        </label>
      </div>
      <div className="export-actions">
        <button
          className="primary"
          onClick={onExportToSoundpad}
          disabled={exporting || !canExport}
        >
          <IconSoundpad size={16} />
          {exporting ? "导出中..." : "导出到 Soundpad"}
        </button>
        <button onClick={onExportFile} disabled={exporting || !canExport}>
          <IconDownload size={15} />
          仅导出文件
        </button>
      </div>
      <div className="export-status">
        {exporting && (
          <>
            <div className="progress"><div className="fill" style={{ width: `${progress}%` }} /></div>
            <span className="status">{progress.toFixed(0)}%</span>
          </>
        )}
        {!exporting && waveformLoading && (
          <span className="status working"><span className="spinner" />分析波形...</span>
        )}
        {!exporting && !waveformLoading && <span className="status idle"><IconFolder size={12} />就绪，选好选区后即可导出</span>}
      </div>
    </div>
  );
});
