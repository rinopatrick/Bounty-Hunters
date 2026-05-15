// t3code:// deep-linking protocol (issue 864).
import{app,protocol}from"electron";
export function register(){protocol.registerSchemesAsPrivileged([{scheme:"t3code",privileges:{secure:true,standard:true}}]);}
if(app.isReady)register();app.on("ready",register);
