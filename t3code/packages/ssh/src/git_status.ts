// Rebase conflict detection + auto-resolve (issue 823).
import { execSync } from "child_process";

export function detectConflicts(repo: string): string[] {
  const out = execSync("git status --porcelain", {cwd:repo,encoding:"utf-8"});
  return out.split("\n").filter(l=>l.startsWith("UU")).map(l=>l.slice(3).trim());
}

export function autoResolve(repo: string, ours: boolean): string {
  const side = ours ? "--ours" : "--theirs";
  execSync(`git checkout ${side} -- .`, {cwd: repo});
  execSync("git add .", {cwd: repo});
  return side;
}
