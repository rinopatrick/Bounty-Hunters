from __future__ import annotations
import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

import Effect
from t3code.apps.server.src.health import HealthMonitor

T = Effect.ServiceContext("CheckpointRetention", {
    effect: Effect.gen(function* () {
      const root = cfg("persist.checkpoint_dir", "/var/checkpoints/")
      const maxBytes = cfg("persist.max_checkpoint_bytes")
      const health = HealthMonitor.Default
      return { root, maxBytes }
    })
    dependencies: [HealthMonitor.Default],
  })
