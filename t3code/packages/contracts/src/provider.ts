// Runtime provider config validation (issue 825).
export type ProvResult = valid|"invalid-id"|"invalid-caps";
export function validateProvider(p:any): ProvResult {
if(typeof p!=="object"||p==null) return "invalid-id";
if(typeof p.id!=="string"||!p.id.trim()) return "invalid-id";
if(p.capabilities && !Array.isArray(p.capabilities)) return "invalid-caps";
return "valid";
}
