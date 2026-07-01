# bookbot

Bookbot is my first git project!

## Muslim Mental Health Database

A small, dependency-free (Python standard library only) database of Muslim
mental health **resources** (organizations, helplines, apps) and
**clinicians**, backed by SQLite. It ships with seed data for well-known
organizations and a command-line interface for searching.

> **Crisis note:** If you or someone you know is in immediate danger, contact
> your local emergency number. In the US you can also call or text **988**
> (Suicide & Crisis Lifeline); in the UK, call **Samaritans** on **116 123**.

### Quick start

```bash
# Create the database and load the bundled seed data
python -m mental_health init

# List or search resources
python -m mental_health resources
python -m mental_health resources -q anxiety

# Filter clinicians by language / specialty / availability
python -m mental_health clinicians --language urdu --accepting
python -m mental_health clinicians --specialty trauma

# Search resources and clinicians together
python -m mental_health search crisis
```

By default the database lives at `data/mental_health.db` (git-ignored). Use
`--db <path>` to point at another file, or `:memory:` for an ephemeral run.

### Programmatic use

```python
from mental_health import Database, Resource, seed

db = Database("data/mental_health.db")
db.initialize()
seed(db)

for r in db.search_resources("youth"):
    print(r.name, r.phone, r.website)

db.add_resource(Resource(
    name="My Local Masjid Counseling",
    category="organization",
    country="US",
    tags=["counseling", "community"],
))
```

### About the data

- **Resources** are real, publicly listed organizations and helplines.
  Contact details change over time — always verify against the official
  source before relying on them.
- **Clinicians** shipped in the seed data are **illustrative samples**
  (`is_sample=True`), not real people. Replace them with vetted, consented
  directory data before any real-world use.

### Layout

```
mental_health/
  models.py       # Resource and Clinician dataclasses
  database.py     # SQLite storage layer + search
  seed_data.py    # bundled resources and sample clinicians
  cli.py          # command-line interface
  __main__.py     # `python -m mental_health`
tests/
  test_database.py
```

### Tests

```bash
python -m unittest discover -s tests
```
