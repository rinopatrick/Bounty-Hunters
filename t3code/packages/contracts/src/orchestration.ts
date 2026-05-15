// Deferred command scheduler with Effect.fiber (issue 851).
import { Effect, Fiber } from "effect";
export class DeferredScheduler {
  private q: Array<{d:number; c:any}> = []; private run=false;
schedule(delay:number, cmd:any){ this.q.push({d:delay,c:cmd}); if(!this.run) this.loop(); }
private async loop(){ this.run=true; while(this.q.length){const x=this.q.shift()!; await Effect.sleep(x.d); Fiber.fork(x.c);} this.run=false;}
}