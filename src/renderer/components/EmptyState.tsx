import { memo } from "react";
import { IconUpload, IconVideo } from "./Icons.js";

export const EmptyState = memo(function EmptyState({ dragOver }: { dragOver: boolean }) {
  return (
    <div className="empty-state">
      <div className={"dropzone" + (dragOver ? " dragover" : "")}>
        <div className="dropzone-visual">
          <div className="dropzone-icon">
            <IconUpload size={26} />
          </div>
          <div className="dropzone-wave">
            <span /><span /><span /><span /><span /><span /><span />
          </div>
        </div>
        <div className="dropzone-title">拖入视频文件，或点击上方「导入视频」</div>
        <div className="hint">
          <IconVideo size={12} />
          支持 MP4 / MKV / MOV / AVI / WebM 等格式，可批量导入
        </div>
      </div>
    </div>
  );
});
