import type { SVGProps } from "react";

type IconName = "add" | "arrow" | "check" | "clock" | "close" | "download" | "external" | "file" | "folder" | "help" | "home" | "lock" | "menu" | "pause" | "play" | "recipe" | "refresh" | "spark" | "trash" | "upload" | "wave" | "wifi";

const paths: Record<IconName, React.ReactNode> = {
  add: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="m9 18 6-6-6-6" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /></>,
  folder: <><path d="M3 6h7l2 2h9v11H3z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.1c-.9.5-1.3 1-1.3 2M12 17h.01" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  pause: <><path d="M9 7v10M15 7v10" /></>,
  play: <><path d="m9 6 9 6-9 6z" /></>,
  recipe: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M18.5 9a7 7 0 0 0-12-2L4 12m16 0-2.5 5a7 7 0 0 1-12 0" /></>,
  spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
  upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" /></>,
  wave: <><path d="M3 12h2l2-6 3 12 3-15 3 13 2-4h3" /></>,
  wifi: <><path d="M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 17a3 3 0 0 1 4 0M12 20h.01" /></>
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
}
