// ARIA attributes + keyboard navigation (issue 852).
import * as React from "react";

export function CodeViewer({code, language=""}:{code:string;language?:string}) {
  const lineRefs = React.useRef<(HTMLDivElement|null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key==="ArrowDown"||e.key==="j") {
      lineRefs.current[0]?.focus();  // first line
    }
  };
  const lines = code.split("\n");
  return (
    <div role="region" aria-label="Code viewer" aria-describedby="code-desc"
      tabIndex={0} onKeyDown={onKeyDown} className="code-viewer">
      <div id="code-desc" className="sr-only">{lines.length} lines of {language||"plain text"}</div>
      {lines.map((ln, i) => (
        <div key={i} role="listitem" aria-label={`Line ${i+1}`}
          tabIndex={-1} ref={el=>lineRefs.current[i]=el}>
          <span aria-hidden="true" className="line-num">{i+1}</span>
          {ln}
        </div>))}
    </div>
  );
}
