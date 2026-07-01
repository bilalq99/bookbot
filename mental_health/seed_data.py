"""Seed data for the Muslim mental health database.

RESOURCES are real, well-known organizations, helplines, and tools that
serve Muslim communities. Details such as phone numbers and websites change
over time — verify them against the official source before relying on them.

CLINICIANS are illustrative *sample* records (``is_sample=True``) that show
how to populate the table. They are not real people. Replace them with
vetted, consented directory data before any real-world use.

If you or someone you know is in immediate danger, contact your local
emergency number. In the US you can also call or text 988 (Suicide & Crisis
Lifeline); in the UK, call Samaritans on 116 123.
"""

from __future__ import annotations

from typing import List

from .database import Database
from .models import Clinician, Resource

RESOURCES: List[Resource] = [
    Resource(
        name="Khalil Center",
        category="organization",
        description=(
            "Psychospiritual community wellness center advancing the "
            "professional practice of psychology rooted in Islamic principles."
        ),
        website="https://khalilcenter.com",
        country="US",
        languages=["English", "Arabic", "Urdu"],
        tags=["therapy", "counseling", "psychospiritual", "community"],
    ),
    Resource(
        name="Naseeha Mental Health",
        category="helpline",
        description=(
            "Confidential peer support helpline and mental health programs "
            "for Muslim youth across North America."
        ),
        website="https://naseeha.org",
        phone="1-866-627-3342",
        country="Canada/US",
        languages=["English", "Urdu", "Arabic"],
        tags=["helpline", "youth", "peer-support", "crisis"],
    ),
    Resource(
        name="Muslim Wellness Foundation",
        category="organization",
        description=(
            "Nonprofit dedicated to reducing stigma associated with mental "
            "illness and trauma through education, advocacy, and training."
        ),
        website="https://www.muslimwellness.com",
        country="US",
        languages=["English"],
        tags=["advocacy", "education", "stigma", "trauma"],
    ),
    Resource(
        name="The Family & Youth Institute (The FYI)",
        category="organization",
        description=(
            "Research and education institute strengthening Muslim families "
            "and youth through evidence-based mental health resources."
        ),
        website="https://www.thefyi.org",
        country="US",
        languages=["English"],
        tags=["research", "family", "youth", "education"],
    ),
    Resource(
        name="Maristan",
        category="organization",
        description=(
            "Holistic mental health organization offering psychospiritual "
            "care, education, and a directory of culturally responsive providers."
        ),
        website="https://maristan.org",
        country="US",
        languages=["English"],
        tags=["therapy", "directory", "psychospiritual", "education"],
    ),
    Resource(
        name="Ruh Care",
        category="app",
        description=(
            "Online platform connecting clients with Muslim therapists and "
            "counselors for faith-sensitive teletherapy."
        ),
        website="https://ruhcare.com",
        country="International",
        languages=["English"],
        tags=["teletherapy", "directory", "online", "therapy"],
    ),
    Resource(
        name="HEART (Health Education Advocacy Research Training)",
        category="organization",
        description=(
            "Provides reproductive and sexual health education and support to "
            "Muslim communities, including trauma-informed programming."
        ),
        website="https://hearttogrow.org",
        country="US",
        languages=["English"],
        tags=["education", "advocacy", "trauma", "wellness"],
    ),
    Resource(
        name="Muslim Youth Helpline (MYH)",
        category="helpline",
        description=(
            "Faith and culturally sensitive support service for young Muslims "
            "in the UK, offering confidential, non-judgemental listening."
        ),
        website="https://www.myh.org.uk",
        phone="0808 808 4994",
        country="UK",
        languages=["English"],
        tags=["helpline", "youth", "peer-support"],
    ),
    Resource(
        name="Lateef Project",
        category="organization",
        description=(
            "Provides free Islamic counselling delivered by qualified Muslim "
            "counsellors across the UK."
        ),
        website="https://lateefproject.org",
        country="UK",
        languages=["English", "Urdu"],
        tags=["counseling", "islamic-counselling", "therapy"],
    ),
    Resource(
        name="Institute for Muslim Mental Health",
        category="organization",
        description=(
            "Promotes scholarship and training in Muslim mental health and "
            "publishes the Journal of Muslim Mental Health."
        ),
        website="https://muslimmentalhealth.com",
        country="US",
        languages=["English"],
        tags=["research", "training", "academic"],
    ),
    Resource(
        name="Amala Hopeline",
        category="helpline",
        description=(
            "Confidential crisis and suicide-prevention hopeline for Muslim "
            "youth and young adults."
        ),
        website="https://www.amalahopeline.org",
        phone="1-855-952-6252",
        country="US",
        languages=["English"],
        tags=["helpline", "crisis", "suicide-prevention", "youth"],
    ),
    Resource(
        name="Stones to Bridges",
        category="organization",
        description=(
            "Youth-led organization in Canada offering mentorship and mental "
            "health support for Muslim youth."
        ),
        website="https://www.stonestobridges.org",
        country="Canada",
        languages=["English"],
        tags=["youth", "mentorship", "peer-support"],
    ),
    Resource(
        name="988 Suicide & Crisis Lifeline",
        category="helpline",
        description=(
            "Free, confidential 24/7 crisis support for anyone in the US in "
            "distress. Not Muslim-specific but universally available."
        ),
        website="https://988lifeline.org",
        phone="988",
        country="US",
        languages=["English", "Spanish"],
        tags=["helpline", "crisis", "24/7", "suicide-prevention"],
    ),
    Resource(
        name="Samaritans",
        category="helpline",
        description=(
            "Free 24/7 emotional support for anyone in distress in the UK and "
            "Ireland. Not Muslim-specific but universally available."
        ),
        website="https://www.samaritans.org",
        phone="116 123",
        country="UK",
        languages=["English"],
        tags=["helpline", "crisis", "24/7"],
    ),
]

# Illustrative sample clinicians. NOT real people — replace before real use.
CLINICIANS: List[Clinician] = [
    Clinician(
        name="Dr. Amina Rahman (sample)",
        title="Licensed Clinical Psychologist",
        organization="Community Wellness Clinic",
        city="Chicago",
        country="US",
        languages=["English", "Urdu"],
        specialties=["anxiety", "depression", "trauma"],
        telehealth=True,
        accepting_new_clients=True,
        website="https://example.org/amina-rahman",
        is_sample=True,
    ),
    Clinician(
        name="Yusuf Karim, LCSW (sample)",
        title="Licensed Clinical Social Worker",
        organization="Faith & Family Counseling",
        city="Toronto",
        country="Canada",
        languages=["English", "Arabic"],
        specialties=["family therapy", "marriage counseling", "grief"],
        telehealth=True,
        accepting_new_clients=False,
        website="https://example.org/yusuf-karim",
        is_sample=True,
    ),
    Clinician(
        name="Fatima Noor, LMFT (sample)",
        title="Licensed Marriage and Family Therapist",
        organization="Sakinah Therapy Group",
        city="London",
        country="UK",
        languages=["English"],
        specialties=["youth", "identity", "anxiety"],
        telehealth=False,
        accepting_new_clients=True,
        website="https://example.org/fatima-noor",
        is_sample=True,
    ),
]


def seed(db: Database) -> None:
    """Populate ``db`` with the bundled resources and sample clinicians.

    Safe to call repeatedly: rows are inserted with ``INSERT OR IGNORE`` so
    duplicates are skipped.
    """
    for resource in RESOURCES:
        db.add_resource(resource)
    for clinician in CLINICIANS:
        db.add_clinician(clinician)
