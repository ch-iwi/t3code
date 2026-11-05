import type { ReactNode } from "react";

import { APP_VERSION } from "../../branding";
import { useDesktopUpdateState } from "../../state/desktopUpdate";

/**
 * The version in Settings → About. The DV³ desktop app has its own version
 * (dv3-version.json), which reaches the page through the desktop update state;
 * the web bundle and the server keep upstream's, shown as the base. Browsers
 * without the desktop bridge only know upstream's version, shown as `children`.
 */
export function Dv3AboutVersion({ children }: { readonly children: ReactNode }) {
  const desktopVersion = useDesktopUpdateState()?.currentVersion;

  if (!desktopVersion || desktopVersion === APP_VERSION) {
    return children;
  }
  return (
    <>
      <code className="text-2xs font-medium text-muted-foreground">{desktopVersion}</code>
      <span className="text-2xs text-muted-foreground">based on T3 Code {APP_VERSION}</span>
    </>
  );
}
