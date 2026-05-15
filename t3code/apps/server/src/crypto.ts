// Encryption key rotation (issue 848).
import {randomBytes} from "crypto";let _key=randomBytes(32);
export function rotateKey(k:Buffer):void{_key=Buffer.from(k);}
export function encrypt(d:Buffer):Buffer{const o=Buffer.alloc(d.length);for(let i=0;i<d.length;i++)o[i]=d[i]^_key[i%32];return o;}
export function decrypt(d:Buffer):Buffer{return encrypt(d);}
