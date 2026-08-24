import type { ReactNode, SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function makeIcon(children: ReactNode) {
  return function Icon({ size = 18, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

export const IconPlus = makeIcon(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconUpload = makeIcon(<><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>);
export const IconVideo = makeIcon(<>
  <rect x="2.5" y="5" width="14" height="14" rx="3" />
  <path d="m16.5 10.5 5-3v9l-5-3" />
</>);
export const IconTrash = makeIcon(<>
  <path d="M3 6h18" />
  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
</>);
export const IconPlay = makeIcon(<path d="M7 4.5v15l13-7.5z" />);
export const IconPause = makeIcon(<><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></>);
export const IconFrameBack = makeIcon(<>
  <path d="M8 5v14" />
  <path d="m18 6-8 6 8 6z" />
</>);
export const IconFrameForward = makeIcon(<>
  <path d="M16 5v14" />
  <path d="m6 6 8 6-8 6z" />
</>);
export const IconSecBack = makeIcon(<>
  <path d="M11 19a8 8 0 1 1 2-15.7L15 5" />
  <path d="M14 4.5 15 5l-1 1" />
</>);
export const IconSecForward = makeIcon(<>
  <path d="M13 5a8 8 0 1 1-2 15.7L9 19" />
  <path d="M10 19.5 9 19l1-1" />
</>);
export const IconWave = makeIcon(<>
  <path d="M3 12h2" />
  <path d="M7 9v6" />
  <path d="M11 5v14" />
  <path d="M15 8v8" />
  <path d="M19 10v4" />
  <path d="M21 12h.5" />
</>);
export const IconScissors = makeIcon(<>
  <circle cx="6" cy="6" r="2.5" />
  <circle cx="6" cy="18" r="2.5" />
  <path d="M8.2 7.5 20 19" />
  <path d="M8.2 16.5 20 5" />
</>);
export const IconDownload = makeIcon(<>
  <path d="M12 3v12" />
  <path d="m7 10 5 5 5-5" />
  <path d="M4 20h16" />
</>);
export const IconSoundpad = makeIcon(<>
  <rect x="3" y="9" width="18" height="10" rx="2.5" />
  <path d="M8 12v4" />
  <path d="M12 10.5v7" />
  <path d="M16 12v4" />
  <path d="M5 4h14" />
  <path d="M12 4v2" />
</>);
export const IconFolder = makeIcon(<>
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
</>);
export const IconCheck = makeIcon(<path d="m4.5 12.5 5 5 10-11" />);
export const IconAlert = makeIcon(<>
  <path d="M12 3 2.5 20h19z" />
  <path d="M12 10v4" />
  <path d="M12 17.5h.01" />
</>);
export const IconInPoint = makeIcon(<>
  <path d="M5 12h9" />
  <path d="m19 8 4 4-4 4" />
  <path d="M2 5v14" />
</>);
export const IconOutPoint = makeIcon(<>
  <path d="M19 12h-9" />
  <path d="m5 8-4 4 4 4" />
  <path d="M22 5v14" />
</>);
export const IconEar = makeIcon(<>
  <path d="M6 8a6 6 0 0 1 12 0c0 4-2 5-2 8" />
  <path d="M16 17.5a2 2 0 0 1-4 .5" />
  <path d="M6 12.5c0 1.8 1 3 2 4" />
</>);
export const IconZoomIn = makeIcon(<>
  <circle cx="11" cy="11" r="7" />
  <path d="m21 21-4.3-4.3" />
  <path d="M11 8v6" />
  <path d="M8 11h6" />
</>);
export const IconZoomOut = makeIcon(<>
  <circle cx="11" cy="11" r="7" />
  <path d="m21 21-4.3-4.3" />
  <path d="M8 11h6" />
</>);
export const IconReset = makeIcon(<>
  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
  <path d="M3 3v5h5" />
</>);
export const IconFile = makeIcon(<>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <path d="M14 2v6h6" />
</>);
export const IconMusic = makeIcon(<>
  <path d="M9 18V5l12-2v13" />
  <circle cx="6" cy="18" r="3" />
  <circle cx="18" cy="16" r="3" />
</>);
