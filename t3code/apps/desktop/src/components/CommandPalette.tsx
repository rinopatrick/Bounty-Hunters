export function FuzzyList({q,items}:{q:string;items:{text:string}[]}){
  const ranked=items.map(i=>({...i,_s:sc(i.text,q)})).sort((a,b)=>b._s-a._s);
  return<ul>{ranked.map((r,i)=>li(highlight(r.text,q)))</ul>;
}
function sc(t:string,q:string):number{let qi=0;for(let i=0;i<t.length&&qi<q.length;i++)
  if(t[i].toLowerCase()===q[qi].toLowerCase()){qi++;}return qi*10;}
function highlight(t:string,q:string):React.ReactNode{let s=0,e=t.length,qf=0;
  for(let i=0;i<t.length&&qf<q.length;i++)if(t[i].toLowerCase()===q[qf].toLowerCase()){s=i;qf++;}
  return t.length?<mark className="hl">{t}</mark>:t;}
