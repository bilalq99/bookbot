"""SQLite storage layer for the Muslim mental health database.

Uses only the Python standard library (``sqlite3`` + ``json``). List-valued
fields are serialized to JSON text columns. Pass ``":memory:"`` as the path
for an ephemeral in-memory database (handy for tests).
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import List, Optional

from .models import Clinician, Resource

SCHEMA = """
CREATE TABLE IF NOT EXISTS resources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    website     TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    country     TEXT NOT NULL DEFAULT '',
    languages   TEXT NOT NULL DEFAULT '[]',
    tags        TEXT NOT NULL DEFAULT '[]',
    UNIQUE(name, country)
);

CREATE TABLE IF NOT EXISTS clinicians (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL,
    title                 TEXT NOT NULL DEFAULT '',
    organization          TEXT NOT NULL DEFAULT '',
    city                  TEXT NOT NULL DEFAULT '',
    country               TEXT NOT NULL DEFAULT '',
    languages             TEXT NOT NULL DEFAULT '[]',
    specialties           TEXT NOT NULL DEFAULT '[]',
    telehealth            INTEGER NOT NULL DEFAULT 0,
    accepting_new_clients INTEGER NOT NULL DEFAULT 1,
    website               TEXT NOT NULL DEFAULT '',
    email                 TEXT NOT NULL DEFAULT '',
    is_sample             INTEGER NOT NULL DEFAULT 1,
    UNIQUE(name, organization)
);
"""


def _dumps(values: List[str]) -> str:
    return json.dumps(list(values or []))


def _loads(text: Optional[str]) -> List[str]:
    if not text:
        return []
    return list(json.loads(text))


class Database:
    """A thin wrapper around a SQLite connection with typed accessors."""

    def __init__(self, path: str = "data/mental_health.db"):
        self.path = path
        if path != ":memory:":
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")

    # -- lifecycle ---------------------------------------------------------
    def initialize(self) -> None:
        """Create tables if they do not already exist."""
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # -- resources ---------------------------------------------------------
    def add_resource(self, resource: Resource) -> int:
        """Insert a resource, ignoring exact duplicates. Returns its id."""
        cur = self.conn.execute(
            """
            INSERT OR IGNORE INTO resources
                (name, category, description, website, phone, country, languages, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                resource.name,
                resource.category,
                resource.description,
                resource.website,
                resource.phone,
                resource.country,
                _dumps(resource.languages),
                _dumps(resource.tags),
            ),
        )
        self.conn.commit()
        if cur.lastrowid:
            return cur.lastrowid
        row = self.conn.execute(
            "SELECT id FROM resources WHERE name = ? AND country = ?",
            (resource.name, resource.country),
        ).fetchone()
        return row["id"] if row else -1

    def list_resources(self) -> List[Resource]:
        rows = self.conn.execute("SELECT * FROM resources ORDER BY name").fetchall()
        return [self._row_to_resource(r) for r in rows]

    def search_resources(self, query: str) -> List[Resource]:
        """Case-insensitive match across name, description, tags, category."""
        like = f"%{query.lower()}%"
        rows = self.conn.execute(
            """
            SELECT * FROM resources
            WHERE lower(name) LIKE ?
               OR lower(description) LIKE ?
               OR lower(tags) LIKE ?
               OR lower(category) LIKE ?
               OR lower(country) LIKE ?
            ORDER BY name
            """,
            (like, like, like, like, like),
        ).fetchall()
        return [self._row_to_resource(r) for r in rows]

    # -- clinicians --------------------------------------------------------
    def add_clinician(self, clinician: Clinician) -> int:
        cur = self.conn.execute(
            """
            INSERT OR IGNORE INTO clinicians
                (name, title, organization, city, country, languages, specialties,
                 telehealth, accepting_new_clients, website, email, is_sample)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clinician.name,
                clinician.title,
                clinician.organization,
                clinician.city,
                clinician.country,
                _dumps(clinician.languages),
                _dumps(clinician.specialties),
                int(clinician.telehealth),
                int(clinician.accepting_new_clients),
                clinician.website,
                clinician.email,
                int(clinician.is_sample),
            ),
        )
        self.conn.commit()
        if cur.lastrowid:
            return cur.lastrowid
        row = self.conn.execute(
            "SELECT id FROM clinicians WHERE name = ? AND organization = ?",
            (clinician.name, clinician.organization),
        ).fetchone()
        return row["id"] if row else -1

    def list_clinicians(self) -> List[Clinician]:
        rows = self.conn.execute("SELECT * FROM clinicians ORDER BY name").fetchall()
        return [self._row_to_clinician(r) for r in rows]

    def search_clinicians(
        self,
        query: str = "",
        *,
        language: str = "",
        specialty: str = "",
        accepting_only: bool = False,
    ) -> List[Clinician]:
        """Filter clinicians by free text, language, specialty, availability."""
        clauses = []
        params: List[object] = []
        if query:
            like = f"%{query.lower()}%"
            clauses.append(
                "(lower(name) LIKE ? OR lower(title) LIKE ? OR "
                "lower(organization) LIKE ? OR lower(city) LIKE ? OR "
                "lower(country) LIKE ? OR lower(specialties) LIKE ?)"
            )
            params.extend([like] * 6)
        if language:
            clauses.append("lower(languages) LIKE ?")
            params.append(f"%{language.lower()}%")
        if specialty:
            clauses.append("lower(specialties) LIKE ?")
            params.append(f"%{specialty.lower()}%")
        if accepting_only:
            clauses.append("accepting_new_clients = 1")

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = self.conn.execute(
            f"SELECT * FROM clinicians {where} ORDER BY name", params
        ).fetchall()
        return [self._row_to_clinician(r) for r in rows]

    # -- helpers -----------------------------------------------------------
    @staticmethod
    def _row_to_resource(row: sqlite3.Row) -> Resource:
        return Resource(
            id=row["id"],
            name=row["name"],
            category=row["category"],
            description=row["description"],
            website=row["website"],
            phone=row["phone"],
            country=row["country"],
            languages=_loads(row["languages"]),
            tags=_loads(row["tags"]),
        )

    @staticmethod
    def _row_to_clinician(row: sqlite3.Row) -> Clinician:
        return Clinician(
            id=row["id"],
            name=row["name"],
            title=row["title"],
            organization=row["organization"],
            city=row["city"],
            country=row["country"],
            languages=_loads(row["languages"]),
            specialties=_loads(row["specialties"]),
            telehealth=bool(row["telehealth"]),
            accepting_new_clients=bool(row["accepting_new_clients"]),
            website=row["website"],
            email=row["email"],
            is_sample=bool(row["is_sample"]),
        )
