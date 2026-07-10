from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Sequence

from radon.complexity import cc_rank, cc_visit


MAX_COMPLEXITY = 40
EXCLUDED_PATH_PARTS = {".venv", "__pycache__", "alembic", "tests"}


@dataclass(frozen=True)
class ComplexityViolation:
    path: str
    line: int
    name: str
    complexity: int

    def format(self, maximum: int = MAX_COMPLEXITY) -> str:
        rank = cc_rank(self.complexity)
        return (
            f"{self.path}:{self.line}: {self.name} has cyclomatic complexity "
            f"{self.complexity} (grade {rank}; maximum {maximum})"
        )


def _callable_blocks(blocks: Iterable[object]) -> Iterator[object]:
    for block in blocks:
        if getattr(block, "letter", None) == "F":
            yield block
        yield from _callable_blocks(getattr(block, "closures", ()))


def find_source_violations(
    source: str,
    *,
    path: str = "<source>",
    max_complexity: int = MAX_COMPLEXITY,
) -> list[ComplexityViolation]:
    violations = []
    for block in _callable_blocks(cc_visit(source)):
        score = int(block.complexity)
        if score <= max_complexity:
            continue
        classname = getattr(block, "classname", None)
        name = f"{classname}.{block.name}" if classname else block.name
        violations.append(
            ComplexityViolation(
                path=path,
                line=int(block.lineno),
                name=name,
                complexity=score,
            )
        )
    return violations


def _python_files(paths: Iterable[Path]) -> Iterator[Path]:
    for path in paths:
        candidates = [path] if path.is_file() else path.rglob("*.py")
        for candidate in candidates:
            if candidate.suffix != ".py":
                continue
            if EXCLUDED_PATH_PARTS.intersection(candidate.parts):
                continue
            yield candidate


def find_complexity_violations(
    paths: Iterable[Path],
    *,
    max_complexity: int = MAX_COMPLEXITY,
) -> list[ComplexityViolation]:
    violations = []
    for path in sorted(_python_files(paths)):
        violations.extend(
            find_source_violations(
                path.read_text(encoding="utf-8"),
                path=str(path),
                max_complexity=max_complexity,
            )
        )
    return violations


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Reject production Python callables with grade-F cyclomatic complexity."
    )
    parser.add_argument("paths", nargs="*", default=["backend"])
    parser.add_argument("--max-complexity", type=int, default=MAX_COMPLEXITY)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    violations = find_complexity_violations(
        (Path(path) for path in args.paths),
        max_complexity=args.max_complexity,
    )
    if violations:
        print("Complexity guard failed:")
        for violation in violations:
            print(f"- {violation.format(args.max_complexity)}")
        return 1
    print(f"Complexity guard passed: no production callable exceeds {args.max_complexity}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
