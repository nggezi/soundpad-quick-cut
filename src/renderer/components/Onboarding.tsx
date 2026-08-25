import { memo, useState } from "react";
import {
  IconPlus,
  IconScissors,
  IconSoundpad,
  IconUpload,
  IconWave,
} from "./Icons.js";

interface Props {
  onFinish: () => void;
}

const STEPS = [
  {
    icon: <IconUpload size={22} />,
    title: "拖入素材",
    desc: "把视频或音频文件拖进窗口，或点击「导入视频」。支持 MP4 / MKV / MOV / MP3 / WAV 等格式，可一次拖多个。",
  },
  {
    icon: <IconScissors size={22} />,
    title: "选中片段",
    desc: "按 I / O 在播放头位置打入出点，或直接在波形上拖拽选区；Ctrl+滚轮缩放时间轴，[ ] 键微调边界。",
  },
  {
    icon: <IconPlus size={22} />,
    title: "攒下多个片段",
    desc: "选好后按 A 或点击「添加片段」，一个素材可以积攒多个音效，素材库中可点击片段快速回到对应选区。",
  },
  {
    icon: <IconSoundpad size={22} />,
    title: "一键导出",
    desc: "命名片段（默认视频名前 5 字，自动 _01 _02），点击「导出到 Soundpad」即可使用，也可批量全部导出。",
  },
];

export const Onboarding = memo(function Onboarding({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <div className="onboarding-logo">
            <IconWave size={20} />
          </div>
          <span>欢迎使用 Soundpad Quick Cut</span>
        </div>

        <div className="onboarding-body">
          <div className="onboarding-icon">{current.icon}</div>
          <div className="onboarding-title">{current.title}</div>
          <div className="onboarding-desc">{current.desc}</div>
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={"dot" + (i === step ? " active" : "")}
                onClick={() => setStep(i)}
                aria-label={`第 ${i + 1} 步`}
              />
            ))}
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="ghost" onClick={onFinish}>跳过</button>
          {step < STEPS.length - 1 ? (
            <button className="primary" onClick={() => setStep((s) => s + 1)}>下一步</button>
          ) : (
            <button className="primary" onClick={onFinish}>开始使用</button>
          )}
        </div>
      </div>
    </div>
  );
});
