/* inline commenting on diff lines (issue 846). */
import * as React from "react";

interface Comment { id:string; line:number; text:string; }
const comments:Comment[]=[];

function addComment(line:number,text:string){
  const id=Math.random().toString(36).slice(2);
  comments.push({id,line,text});
}

export function DiffPanelShell({diffs}:{diffs:any[]}){
  const[openLine,setOpenLine]=React.useState<number|null>(null);
  const[text,setText]=React.useState("");
  return(
    <div className="diff-shell">
      <div className="comment-count-badge">{comments.length} comments</div>
      {diffs.map((d,i)=>(
        <div key={i} className="diff-line"
          onClick={()=>setOpenLine(openLine===d.line_number?null:d.line_number)}>
          <span className="line-num">{d.line_number}</span>
          <span className="line-content">{d.content}</span>
          {openLine===d.line_number&&
            <input value={text} onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&text.trim()){addComment(d.line_number,text);setText("");}}}
              placeholder="Add comment…" />
          }
          {comments.filter(c=>c.line===d.line_number).map(c=>
            <details key={c.id}><summary>Comment</summary><div className="cmt-body">{c.text}</div></details>
          )}
        </div>))}
    </div>
  );
}
