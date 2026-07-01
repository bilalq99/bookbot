"""Command-line interface for the Muslim mental health database.

Examples::

    python -m mental_health init          # create db and load seed data
    python -m mental_health resources      # list all resources
    python -m mental_health resources -q anxiety
    python -m mental_health clinicians --language urdu --accepting
    python -m mental_health search crisis  # search resources + clinicians
"""

from __future__ import annotations

import argparse
from typing import List, Sequence

from .database import Database
from .models import Clinician, Resource
from .seed_data import seed

DEFAULT_DB = "data/mental_health.db"


def _format_resource(r: Resource) -> str:
    lines = [f"• {r.name}  [{r.category}]"]
    if r.description:
        lines.append(f"    {r.description}")
    meta = []
    if r.phone:
        meta.append(f"phone: {r.phone}")
    if r.website:
        meta.append(f"web: {r.website}")
    if r.country:
        meta.append(f"country: {r.country}")
    if meta:
        lines.append("    " + " | ".join(meta))
    if r.languages:
        lines.append("    languages: " + ", ".join(r.languages))
    if r.tags:
        lines.append("    tags: " + ", ".join(r.tags))
    return "\n".join(lines)


def _format_clinician(c: Clinician) -> str:
    header = f"• {c.name}"
    if c.title:
        header += f" — {c.title}"
    lines = [header]
    where = ", ".join(x for x in (c.city, c.country) if x)
    org_where = " | ".join(x for x in (c.organization, where) if x)
    if org_where:
        lines.append(f"    {org_where}")
    if c.specialties:
        lines.append("    specialties: " + ", ".join(c.specialties))
    if c.languages:
        lines.append("    languages: " + ", ".join(c.languages))
    flags = []
    flags.append("telehealth" if c.telehealth else "in-person")
    flags.append("accepting new clients" if c.accepting_new_clients else "waitlist/closed")
    lines.append("    " + " | ".join(flags))
    if c.website:
        lines.append(f"    web: {c.website}")
    return "\n".join(lines)


def _open(args: argparse.Namespace, *, initialize: bool = False) -> Database:
    db = Database(args.db)
    if initialize:
        db.initialize()
    return db


def cmd_init(args: argparse.Namespace) -> int:
    db = _open(args, initialize=True)
    seed(db)
    n_res = len(db.list_resources())
    n_cli = len(db.list_clinicians())
    db.close()
    print(f"Initialized {args.db}")
    print(f"  {n_res} resources, {n_cli} clinicians loaded.")
    return 0


def cmd_resources(args: argparse.Namespace) -> int:
    db = _open(args, initialize=True)
    results = db.search_resources(args.query) if args.query else db.list_resources()
    db.close()
    _print_section("Resources", [_format_resource(r) for r in results])
    return 0


def cmd_clinicians(args: argparse.Namespace) -> int:
    db = _open(args, initialize=True)
    results = db.search_clinicians(
        args.query or "",
        language=args.language or "",
        specialty=args.specialty or "",
        accepting_only=args.accepting,
    )
    db.close()
    _print_section("Clinicians", [_format_clinician(c) for c in results])
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    db = _open(args, initialize=True)
    resources = db.search_resources(args.query)
    clinicians = db.search_clinicians(args.query)
    db.close()
    _print_section("Resources", [_format_resource(r) for r in resources])
    print()
    _print_section("Clinicians", [_format_clinician(c) for c in clinicians])
    return 0


def _print_section(title: str, blocks: Sequence[str]) -> None:
    print(f"=== {title} ({len(blocks)}) ===")
    if not blocks:
        print("  (no matches)")
        return
    print("\n".join(blocks))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mental_health",
        description="Muslim mental health resources and clinicians database.",
    )
    parser.add_argument(
        "--db", default=DEFAULT_DB, help=f"path to the SQLite file (default: {DEFAULT_DB})"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="create the database and load seed data")
    p_init.set_defaults(func=cmd_init)

    p_res = sub.add_parser("resources", help="list or search resources")
    p_res.add_argument("-q", "--query", help="free-text search")
    p_res.set_defaults(func=cmd_resources)

    p_cli = sub.add_parser("clinicians", help="list or filter clinicians")
    p_cli.add_argument("-q", "--query", help="free-text search")
    p_cli.add_argument("--language", help="filter by language")
    p_cli.add_argument("--specialty", help="filter by specialty")
    p_cli.add_argument(
        "--accepting", action="store_true", help="only clinicians accepting new clients"
    )
    p_cli.set_defaults(func=cmd_clinicians)

    p_search = sub.add_parser("search", help="search resources and clinicians together")
    p_search.add_argument("query", help="free-text search term")
    p_search.set_defaults(func=cmd_search)

    return parser


def main(argv: List[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)
