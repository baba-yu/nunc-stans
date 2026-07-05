"""Pytest collection-time setup.

Adds the repo root to ``sys.path`` so tests can ``import`` modules using
the same ``app.<package>`` paths used by the CLI (which runs as
``python -m app.src.cli`` from the repo root). Without this, tests run
from ``app/`` cwd would only see top-level ``src`` / ``skills`` /
``tests`` packages and any cross-package import like
``from app.src.timewindow import parse_time_window`` (used by skills)
would fail.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
