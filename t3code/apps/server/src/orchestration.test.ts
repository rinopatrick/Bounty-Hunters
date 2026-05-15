import {describe,it,expect} from "vitest";
describe("schema rt",()=>{it("ok",()=>{const c={id:"1"};expect(JSON.stringify(c)).toBe("{\"id\":\"1\"}");});it("rejects unknown",()=>{const{__x,...y}=JSON.parse('{"id":"1","__x":9}');expect(__x).toBeUndefined();});});
