// Syntax-highlighted code viewer with copy button (issue 837).
import*as React from"react";
import{Prism as H}from"react-syntax-highlighter";import{vscDarkPlus}from"react-syntax-highlighter/dist/esm/styles/prism";
export function CodeViewer({code,lang=""}:{code:string;lang?:string}){
const[c,s]=React.useState(false);
return <div className="code-viewer relative">
<button onClick={async()=>{await navigator.clipboard.writeText(code);s(true);}} className="btn absolute right-2 top-2">{c?"Copied!":"Copy"}</button>
<H language={lang} style={vscDarkPlus}>{code}</H>
</div>;}
