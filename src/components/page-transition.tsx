import { ViewTransition } from "react";

export function PageTransition({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ViewTransition name="musicmixer-page" share="page-crossfade" default="none">
      <div className="page-transition-shell">{children}</div>
    </ViewTransition>
  );
}
