export function ResizableSidebar({w=250}:{w?:number}){
  const[d,d2]=React.useState(false);const sw=React.useRef(w);
  const move=(e:any)=>{sp.current(e.clientX);};
  React.useEffect(()=>{if(d){window.addeventlistener("mousemove",move);window.addeventlistener("mouseup",()=>d2(false),{once:true});}
  return()=>{window.removeeventlistener("mousemove",move);};[d]);
  return<aside style={{width:w,cursor:"col-resize"}} onMouseDown={()=>d2(true)}>
    <div style={{position:"absolute",right:0,top:0,bottom:0,width:4,cursor:"col-resize"}}/>
  </aside>;
}
