/* Cross-platform copy/paste keybindings (issue 824). */
import * as React from "react";

function isMac(): boolean {
  return typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
}

export function useClipboard(term: any) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === "C") { if (term?.getSelection) { navigator.clipboard?.writeText(term.getSelection());
        const t = document.createElement("div");
        t.className="t3-toast";t.textContent="Copied!";document.body.appendChild(t);
        setTimeout(()=>t.remove(),1200); } }
      if (e.key === "V") { navigator.clipboard?.readText().then(txt=>term?.paste?.(txt) ?? void 0); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [term]);
}