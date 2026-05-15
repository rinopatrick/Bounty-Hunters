// Request body size limit middleware (issue 841).
export function bodyLimit(maxBytes:number){return (req:any,_:any,next:any)=>{let b=0;req.on("data",c=>{b+=c.length;if(b>maxBytes)res.status(413).end();});req.on("end",next);};}
