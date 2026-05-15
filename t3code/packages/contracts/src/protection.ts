// Branch protection status (issue 854).
export interface BranchProtection{branch:string;requireReviews:boolean;dismissStale:boolean;}
export function enforce(bp:BranchProtection):boolean{return bp.requireReviews&&bp.dismissStale;}
