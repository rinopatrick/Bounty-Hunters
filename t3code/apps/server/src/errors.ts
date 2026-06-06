// Standardized error types (issue 861).
export class AppError extends Error {
constructor(readonly code:string,readonly status:number=500,readonly details?:Record<string,unknown>){super(code);this.name="AppError";}
}
export const Errors = {
NotFound:(id="resource")=>new AppError("not_found",404,{id}),
BadRequest:(m="bad request")=>new AppError("bad_request",400,{m}),
Unauthorized:()=>new AppError("unauthorized",401),
Forbidden:(m="forbidden")=>new AppError("forbidden",403,{m}),
Conflict:(m="conflict")=>new AppError("conflict",409,{m}),
} as const;
