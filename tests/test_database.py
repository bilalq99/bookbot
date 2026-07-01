"""Tests for the Muslim mental health database (standard-library unittest)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mental_health import Clinician, Database, Resource, seed  # noqa: E402


class DatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = Database(":memory:")
        self.db.initialize()

    def tearDown(self) -> None:
        self.db.close()

    def test_add_and_list_resource(self) -> None:
        rid = self.db.add_resource(
            Resource(name="Test Org", category="organization", tags=["therapy"])
        )
        self.assertGreater(rid, 0)
        resources = self.db.list_resources()
        self.assertEqual(len(resources), 1)
        self.assertEqual(resources[0].name, "Test Org")
        self.assertEqual(resources[0].tags, ["therapy"])

    def test_duplicate_resource_ignored(self) -> None:
        r = Resource(name="Dup", category="organization", country="US")
        first = self.db.add_resource(r)
        second = self.db.add_resource(r)
        self.assertEqual(first, second)
        self.assertEqual(len(self.db.list_resources()), 1)

    def test_search_resources_matches_tags_and_description(self) -> None:
        self.db.add_resource(
            Resource(
                name="Helpline X",
                category="helpline",
                description="crisis support for youth",
                tags=["crisis"],
            )
        )
        self.db.add_resource(Resource(name="Random", category="app"))
        self.assertEqual(len(self.db.search_resources("crisis")), 1)
        self.assertEqual(len(self.db.search_resources("YOUTH")), 1)
        self.assertEqual(len(self.db.search_resources("nomatch")), 0)

    def test_add_and_filter_clinicians(self) -> None:
        self.db.add_clinician(
            Clinician(
                name="A",
                languages=["Urdu"],
                specialties=["anxiety"],
                accepting_new_clients=True,
            )
        )
        self.db.add_clinician(
            Clinician(
                name="B",
                languages=["Arabic"],
                specialties=["grief"],
                accepting_new_clients=False,
            )
        )
        self.assertEqual(len(self.db.search_clinicians(language="urdu")), 1)
        self.assertEqual(len(self.db.search_clinicians(specialty="grief")), 1)
        self.assertEqual(len(self.db.search_clinicians(accepting_only=True)), 1)
        self.assertEqual(len(self.db.list_clinicians()), 2)

    def test_clinician_boolean_roundtrip(self) -> None:
        self.db.add_clinician(
            Clinician(name="C", telehealth=True, accepting_new_clients=False)
        )
        c = self.db.list_clinicians()[0]
        self.assertIs(c.telehealth, True)
        self.assertIs(c.accepting_new_clients, False)

    def test_seed_populates_both_tables(self) -> None:
        seed(self.db)
        self.assertGreater(len(self.db.list_resources()), 5)
        self.assertGreater(len(self.db.list_clinicians()), 0)
        # Idempotent: seeding again does not duplicate rows.
        before = len(self.db.list_resources())
        seed(self.db)
        self.assertEqual(len(self.db.list_resources()), before)

    def test_seed_clinicians_are_marked_samples(self) -> None:
        seed(self.db)
        self.assertTrue(all(c.is_sample for c in self.db.list_clinicians()))


if __name__ == "__main__":
    unittest.main()
