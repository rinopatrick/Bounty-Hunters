// Fiber interrupt no-op guard (issue 818).
let _ir=false;
export function markInterrupted(r?:string):void{_ir=true;if(r)console.warn("[orch] interrupted:",r);}
export function isInterrupted():boolean{return _ir;}
export function reset():void{_ir=false;}
