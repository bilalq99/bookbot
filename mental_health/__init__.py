"""Muslim mental health resources and clinicians database.

A small, dependency-free (standard-library only) package for storing,
seeding, and searching a directory of Muslim mental health resources
(organizations, helplines, apps) and clinicians.

Public API::

    from mental_health import Database, seed

    db = Database("data/mental_health.db")
    db.initialize()
    seed(db)
    db.search_resources("anxiety")
"""

from .models import Clinician, Resource
from .database import Database
from .seed_data import seed

__all__ = ["Database", "Resource", "Clinician", "seed"]
__version__ = "0.1.0"
