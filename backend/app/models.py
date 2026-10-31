from sqlalchemy import BigInteger, Boolean, Float, Index, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Review(Base):
    __tablename__ = "reviews"

    review_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    app_id: Mapped[int] = mapped_column(Integer, index=True)
    app_name: Mapped[str] = mapped_column(String(200))
    language: Mapped[str] = mapped_column(String(64), index=True)
    recommended: Mapped[bool] = mapped_column(Boolean, index=True)
    votes_helpful: Mapped[int] = mapped_column(Integer)
    votes_funny: Mapped[int] = mapped_column(Integer)
    comment_count: Mapped[int] = mapped_column(Integer)
    weighted_vote_score: Mapped[float] = mapped_column(Float)
    timestamp_created: Mapped[int] = mapped_column(Integer, index=True)
    timestamp_updated: Mapped[int] = mapped_column(Integer)
    author_steamid: Mapped[int] = mapped_column(BigInteger, index=True)
    playtime_at_review: Mapped[float | None] = mapped_column(
        Float, nullable=True, index=True
    )
    playtime_forever: Mapped[float | None] = mapped_column(Float, nullable=True)
    steam_purchase: Mapped[bool] = mapped_column(Boolean, index=True)
    received_for_free: Mapped[bool] = mapped_column(Boolean, index=True)
    early_access: Mapped[bool] = mapped_column(Boolean, index=True)
    excerpt: Mapped[str] = mapped_column(String(280), default="")

    __table_args__ = (
        Index("ix_reviews_recommended_author", "recommended", "author_steamid"),
    )
