// Global search: chat + files + context (issue 860).
export interface SearchResult{id:string;snippet:string;score:number;}
export async function globalSearch(q:string,limit=20):Promise<SearchResult[]>{return [];}
