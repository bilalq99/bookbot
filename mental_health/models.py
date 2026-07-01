"""Data models for the Muslim mental health database.

These are lightweight ``dataclass`` records used to move rows in and out of
the SQLite store. List-valued fields (``tags``, ``languages``,
``specialties``) are stored in the database as JSON text and exposed here as
Python lists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Resource:
    """An organization, helpline, app, or other mental health resource."""

    name: str
    category: str  # e.g. "organization", "helpline", "app", "directory"
    description: str = ""
    website: str = ""
    phone: str = ""
    country: str = ""
    languages: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    id: Optional[int] = None


@dataclass
class Clinician:
    """A mental health clinician who serves Muslim clients.

    Individual clinician records seeded with this package are illustrative
    samples. Populate the table with vetted, consented, real-world data
    before using it in production.
    """

    name: str
    title: str = ""  # e.g. "Licensed Clinical Psychologist"
    organization: str = ""
    city: str = ""
    country: str = ""
    languages: List[str] = field(default_factory=list)
    specialties: List[str] = field(default_factory=list)
    telehealth: bool = False
    accepting_new_clients: bool = True
    website: str = ""
    email: str = ""
    is_sample: bool = True
    id: Optional[int] = None
