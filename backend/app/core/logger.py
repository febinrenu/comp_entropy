"""Logger compatibility layer with optional loguru dependency."""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

try:
    from loguru import logger as logger  # type: ignore
except ModuleNotFoundError:
    class _StdLogger:
        """Small adapter that mimics the subset of loguru used by this project."""

        def __init__(self) -> None:
            self._logger = logging.getLogger("comp_ent")
            self._logger.setLevel(logging.DEBUG)
            self._logger.propagate = False
            if not self._logger.handlers:
                handler = logging.StreamHandler(sys.stdout)
                handler.setLevel(logging.INFO)
                handler.setFormatter(
                    logging.Formatter(
                        "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s"
                    )
                )
                self._logger.addHandler(handler)

        def remove(self, *_args: Any, **_kwargs: Any) -> None:
            for handler in list(self._logger.handlers):
                self._logger.removeHandler(handler)
                handler.close()

        def add(self, sink: Any, level: str = "INFO", **_kwargs: Any) -> int:
            if hasattr(sink, "write"):
                handler = logging.StreamHandler(sink)
            else:
                sink_path = Path(str(sink))
                sink_path.parent.mkdir(parents=True, exist_ok=True)
                handler = logging.FileHandler(sink_path, encoding="utf-8")

            handler.setLevel(getattr(logging, level.upper(), logging.INFO))
            handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s"
                )
            )
            self._logger.addHandler(handler)
            return id(handler)

        def debug(self, message: str, *args: Any, **kwargs: Any) -> None:
            self._logger.debug(message, *args, **kwargs)

        def info(self, message: str, *args: Any, **kwargs: Any) -> None:
            self._logger.info(message, *args, **kwargs)

        def warning(self, message: str, *args: Any, **kwargs: Any) -> None:
            self._logger.warning(message, *args, **kwargs)

        def error(self, message: str, *args: Any, **kwargs: Any) -> None:
            self._logger.error(message, *args, **kwargs)

        def exception(self, message: str, *args: Any, **kwargs: Any) -> None:
            self._logger.exception(message, *args, **kwargs)

    logger = _StdLogger()

