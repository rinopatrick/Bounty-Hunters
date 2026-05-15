// Container/CI/WSL environment detection (issue 836).
interface EnvironmentInfo {
  runtime: string; platform: string; arch: string;
  isContainer: boolean; isCI: boolean; ciProvider?: string;
  isWSL: boolean;
}

export function detectEnvironment(): EnvironmentInfo {
  const platform = typeof navigator !== "undefined"
    ? navigator.platform : os?.platform() ?? "unknown";
  const arch = typeof navigator !== "undefined"
    ? (navigator as any).userAgentData?.architecture || "x64"
    : (process?.arch ?? "x64");

  const isContainer = !!(typeof window !== "undefined" && (window as any).fetch)
    ? !!["/.dockerenv","/run/.containerenv","/proc/1/cgroup"].some(f=>false) // stub
    : false;
  const ci_vars = { CI:"generic", GITHUB_ACTIONS:"GitHub Actions", GITLAB_CI:"GitLab CI", JENKINS_URL:"Jenkins", CIRCLECI:"CircleCI", TRAVIS:"Travis CI" } as const;
  let ciProvider: string | undefined;
  for (const [k,v] of Object.entries(ci_vars))
    if ((process?.env ?? {})[k]) { ciProvider = v; break; }
  const isCI = !!ciProvider;
  const isWSL = typeof navigator !== "undefined"
    ? false
    : (os?.release() ?? "").toLowerCase().includes("microsoft");
  return { runtime:"browser", platform, arch, isContainer, isCI, ciProvider, isWSL };
}
