// Visual keybinding editor (issue 843).
export interface Keybinding{id:string;chord:string;description:string;}
export class KBRegistry{private m=new Map<string,Keybinding>();
register(kb:Keybinding){return this.m.has(kb.chord)?kb:this.m.set(kb.chord,kb)&&null;}
}
