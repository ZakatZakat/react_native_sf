"""All ORM models for the `curator` schema.

Loose coupling with backend's `users` table via `user_id` (BigInt) — no FK.
Both services share the same Postgres but live in different schemas.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SCHEMA = "curator"


class Base(DeclarativeBase):
    pass


# ────────────────────────────────────────────────────────────────────
# Channels — registry of TG sources
# ────────────────────────────────────────────────────────────────────
class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = ({"schema": SCHEMA},)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    handle: Mapped[str] = mapped_column(String(128), unique=True, index=True)  # @garagemca
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    subs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    poll_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    poll_interval_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    last_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


# ────────────────────────────────────────────────────────────────────
# Raw posts — every fetched message (event or not)
# ────────────────────────────────────────────────────────────────────
class PostRaw(Base):
    __tablename__ = "posts_raw"
    __table_args__ = (
        UniqueConstraint("channel_id", "message_id", name="uq_posts_raw_channel_msg"),
        Index("ix_posts_raw_published_at", "published_at"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    channel_id: Mapped[int] = mapped_column(BigInteger, ForeignKey(f"{SCHEMA}.channels.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    media_urls: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


# ────────────────────────────────────────────────────────────────────
# Events curated — passed the event-detector filter
# ────────────────────────────────────────────────────────────────────
class EventStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    manual_review = "manual_review"


class EventCurated(Base):
    __tablename__ = "events_curated"
    __table_args__ = (
        Index("ix_events_status", "status"),
        Index("ix_events_event_time", "event_time"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey(f"{SCHEMA}.posts_raw.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Extracted structure
    event_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    event_time_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    location_text: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    location_meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    price_text: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    price_kopecks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Filter result
    filter_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    filter_reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Moderation status
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status", schema=SCHEMA),
        default=EventStatus.pending,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


# ────────────────────────────────────────────────────────────────────
# Tags — taxonomy
# ────────────────────────────────────────────────────────────────────
class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = ({"schema": SCHEMA},)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    symbol: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey(f"{SCHEMA}.tags.id"), nullable=True)
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


class ClassifierSource(str, enum.Enum):
    keyword = "keyword"
    embedding = "embedding"
    llm = "llm"
    manual = "manual"


class EventTag(Base):
    __tablename__ = "event_tags"
    __table_args__ = (
        UniqueConstraint("event_id", "tag_id", name="uq_event_tag"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(BigInteger, ForeignKey(f"{SCHEMA}.events_curated.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey(f"{SCHEMA}.tags.id", ondelete="CASCADE"), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    source: Mapped[ClassifierSource] = mapped_column(
        Enum(ClassifierSource, name="classifier_source", schema=SCHEMA),
        default=ClassifierSource.keyword,
        nullable=False,
    )


# ────────────────────────────────────────────────────────────────────
# Ingest runs — health of polling
# ────────────────────────────────────────────────────────────────────
class IngestStatus(str, enum.Enum):
    success = "success"
    partial = "partial"
    failed = "failed"


class IngestRun(Base):
    __tablename__ = "ingest_runs"
    __table_args__ = (
        Index("ix_ingest_runs_started", "started_at"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    channel_id: Mapped[int] = mapped_column(BigInteger, ForeignKey(f"{SCHEMA}.channels.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    status: Mapped[IngestStatus] = mapped_column(
        Enum(IngestStatus, name="ingest_status", schema=SCHEMA),
        default=IngestStatus.success,
        nullable=False,
    )
    posts_fetched: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    posts_new: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    events_extracted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


# ────────────────────────────────────────────────────────────────────
# User-side: interests, feedback, push
# user_id = backend's users.telegram_id (loose ref, no FK across schemas)
# ────────────────────────────────────────────────────────────────────
class UserInterest(Base):
    __tablename__ = "user_interests"
    __table_args__ = (
        UniqueConstraint("user_id", "tag_key", name="uq_user_interest"),
        Index("ix_user_interests_user", "user_id"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tag_key: Mapped[str] = mapped_column(String(64), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


class FeedbackAction(str, enum.Enum):
    like = "like"
    hide = "hide"
    save = "save"
    dismiss = "dismiss"


class UserFeedback(Base):
    __tablename__ = "user_feedback"
    __table_args__ = (
        Index("ix_feedback_user_event", "user_id", "event_id"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    event_id: Mapped[int] = mapped_column(BigInteger, ForeignKey(f"{SCHEMA}.events_curated.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[FeedbackAction] = mapped_column(
        Enum(FeedbackAction, name="feedback_action", schema=SCHEMA),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


# ────────────────────────────────────────────────────────────────────
# Moderation queue
# ────────────────────────────────────────────────────────────────────
class ModerationQueue(Base):
    __tablename__ = "moderation_queue"
    __table_args__ = (
        Index("ix_modq_status", "status"),
        {"schema": SCHEMA},
    )

    event_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(f"{SCHEMA}.events_curated.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status", schema=SCHEMA, create_type=False),
        default=EventStatus.pending,
        nullable=False,
    )
    reviewed_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)


# ────────────────────────────────────────────────────────────────────
# Web Push
# ────────────────────────────────────────────────────────────────────
class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "endpoint", name="uq_push_user_endpoint"),
        Index("ix_push_subs_user", "user_id"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)


class PushStatus(str, enum.Enum):
    sent = "sent"
    failed = "failed"
    dropped = "dropped"


class PushLog(Base):
    __tablename__ = "push_log"
    __table_args__ = (
        Index("ix_push_log_user_sent", "user_id", "sent_at"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    event_id: Mapped[int] = mapped_column(BigInteger, ForeignKey(f"{SCHEMA}.events_curated.id", ondelete="CASCADE"), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    status: Mapped[PushStatus] = mapped_column(
        Enum(PushStatus, name="push_status", schema=SCHEMA),
        nullable=False,
    )
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


# ── Geocode cache ────────────────────────────────────────────────────
# Resolved coordinates per query string (venue text / channel venue), so
# we never hit the geocoder twice for the same place. A row with lat=NULL
# means "geocoder returned nothing" — cached as a negative result.
class GeocodeCache(Base):
    __tablename__ = "geocode_cache"
    __table_args__ = ({"schema": SCHEMA},)

    query: Mapped[str] = mapped_column(String(512), primary_key=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
