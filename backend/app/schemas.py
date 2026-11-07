from typing import Literal

from pydantic import BaseModel

ReviewSortBy = Literal["created_at", "votes_helpful", "playtime_hours"]
SortDir = Literal["asc", "desc"]


class ReviewFilters(BaseModel):
    app_id: int | None = None
    language: str | None = None
    recommended: bool | None = None
    steam_purchase: bool | None = None
    received_for_free: bool | None = None
    early_access: bool | None = None
    playtime_bucket: str | None = None
    date_from: str | None = None
    date_to: str | None = None


class GameFacet(BaseModel):
    app_id: int
    app_name: str
    review_count: int


class LanguageFacet(BaseModel):
    language: str
    review_count: int


class MetricsResponse(BaseModel):
    total_reviews: int
    recommendation_rate: float
    game_count: int
    author_count: int
    games: list[GameFacet]
    languages: list[LanguageFacet]


class ReviewItem(BaseModel):
    review_id: int
    app_id: int
    app_name: str
    language: str
    recommended: bool
    votes_helpful: int
    votes_funny: int
    comment_count: int
    playtime_at_review_hours: float | None
    steam_purchase: bool
    received_for_free: bool
    early_access: bool
    created_at: str
    excerpt: str


class ReviewListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ReviewItem]


class PlaytimePoint(BaseModel):
    key: str
    label: str
    review_count: int
    recommendation_rate: float | None


class GameBar(BaseModel):
    app_name: str
    review_count: int


class LanguageBar(BaseModel):
    language: str
    review_count: int
    recommendation_rate: float | None


class MonthPoint(BaseModel):
    month: str
    review_count: int


class ChartsResponse(BaseModel):
    playtime: list[PlaytimePoint]
    games: list[GameBar]
    languages: list[LanguageBar]
    months: list[MonthPoint]


class GameFacetCount(BaseModel):
    app_id: int
    review_count: int


class LanguageFacetCount(BaseModel):
    language: str
    review_count: int


class FacetsResponse(BaseModel):
    games: list[GameFacetCount]
    languages: list[LanguageFacetCount]


ChatRole = Literal["user", "assistant"]


class ChatHistoryItem(BaseModel):
    role: ChatRole
    content: str


class ChatRequest(BaseModel):
    message: str
    filters: ReviewFilters = ReviewFilters()
    history: list[ChatHistoryItem] = []


class ChatResponse(BaseModel):
    reply: str
    model: str
    tools_used: list[str] = []

