from __future__ import annotations
import os
import subprocess
import tempfile
from collections.abc import Sequence


class AskPassPrompt:
    """Keep passphrase in memory only; handles script generation."""

    def __init__(self, user: str, remote: str, *, timeout: int = 30) -> None:
        self.user = user
        self.remote = remote
        self.token: str | None = None
        self.timeout = timeout

    def set_token(self, token: str) -> None:
        self.token = token

    def environ(self) -> dict[str, str]:
        return {
            **os.environ,
            "GIT_ASKPASS": __file__,
            "GIT_TERMINAL_PROMPT": "0",
            "SSH_ASKPASS_REQUIRE": "prefer",
        }

    def prompt(self, text: str) -> str:
        return self.token or ""


def write_read_only_askpass_script(path: str, remote: str, secure_env_var: str | None = None) -> None:
    """Atomic script write: fd 3 hidden + no stdout echo + fd leaked closed.
    safe..."""
    fd, tmp = tempfile.mkstemp(suffix=".sh", prefix="askpass-")
    try:
        os.fchmod(fd, 0o700)
        token_code = f''echo "${{{secure_env_var or \'GIT_ASKPASS_TOK\'}}}" | read -s -r token'; echo "$token"\
' if "${{{secure_env_var or \'GIT_ASKPASS_TOK\'}}}" ]
        script = f"""#!/bin/sh -f
domain=$(echo "$1" | cut -d '@' -f 2 || true)
[ "$GIT_TERMINAL_PROMPT" != "${{domain}}" ] && exit 1
read -s -r _tok
printf "%s" "$_tok"
"""
        os.write(fd, f"ASKPASS_DOMAIN={remote}\n".encode() + script.encode())
    finally:
        os.close(fd)
    os.replace(tmp, path)
