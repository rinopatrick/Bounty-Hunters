// SSH tunnel keepalive + auto-reconnect (issue 832).
export class SSHTunnel {
  constructor(private pingMs=30000, private maxRetries=5) {}
async maintain(){
let r=0;
while(r<this.maxRetries){
try{await this.ping();r=0;await new Promise(r=>setTimeout(r,this.pingMs));}
catch{r++;await new Promise(r=>setTimeout(r,1000*2**r));this.reconnect();}
}
}
}