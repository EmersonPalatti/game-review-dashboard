from __future__ import annotations

import re
import unicodedata
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models import Review
from backend.app.queries import _global_facets, _store, apply_filters, metrics
from backend.app.schemas import ReviewFilters

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def _normalize_text(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return _NON_ALNUM.sub(" ", ascii_only.lower()).strip()


def _score_match(query_norm: str, query_tokens: list[str], candidate: str) -> int:
    cand_norm = _normalize_text(candidate)
    if not cand_norm:
        return 0
    if cand_norm == query_norm:
        return 100
    if cand_norm.startswith(query_norm):
        return 85
    if query_norm in cand_norm:
        return 70
    if not query_tokens:
        return 0
    cand_tokens = set(cand_norm.split())
    hits = sum(1 for tok in query_tokens if any(tok in ct for ct in cand_tokens))
    if hits == 0:
        return 0
    return int(40 * (hits / len(query_tokens)))


def resolve_game_catalog(
    session: Session,
    query: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """Resolve nomes de jogos e idiomas contra o catálogo completo (59 jogos)."""
    games, languages = _global_facets(_store(session))
    clamped_limit = max(1, min(60, limit if isinstance(limit, int) else 20))

    raw_query = (query or "").strip()
    if not raw_query:
        return {
            "query": None,
            "total_games_in_catalog": len(games),
            "total_languages_in_catalog": len(languages),
            "matched_games": [g.model_dump() for g in games[:clamped_limit]],
            "matched_languages": [l.model_dump() for l in languages],
        }

    q_norm = _normalize_text(raw_query)
    q_tokens = [tok for tok in q_norm.split() if tok]

    scored_games: list[tuple[int, int, dict[str, Any]]] = []
    for game in games:
        score = _score_match(q_norm, q_tokens, game.app_name)
        if str(game.app_id) == raw_query:
            score = 100
        if score > 0:
            scored_games.append((score, game.review_count, game.model_dump()))
    scored_games.sort(key=lambda item: (-item[0], -item[1]))

    scored_langs: list[tuple[int, int, dict[str, Any]]] = []
    for lang in languages:
        score = _score_match(q_norm, q_tokens, lang.language)
        if score > 0:
            scored_langs.append((score, lang.review_count, lang.model_dump()))
    scored_langs.sort(key=lambda item: (-item[0], -item[1]))

    return {
        "query": raw_query,
        "total_games_in_catalog": len(games),
        "total_languages_in_catalog": len(languages),
        "matched_games": [item[2] for item in scored_games[:clamped_limit]],
        "matched_languages": [item[2] for item in scored_langs[:10]],
    }


def _empty_engagement_bucket() -> dict[str, Any]:
    return {
        "review_count": 0,
        "avg_votes_helpful": 0.0,
        "max_votes_helpful": 0,
        "avg_votes_funny": 0.0,
        "avg_comment_count": 0.0,
        "avg_playtime_hours": None,
        "avg_excerpt_chars": 0.0,
    }


def get_engagement_stats(session: Session, filters: ReviewFilters) -> dict[str, Any]:
    """Calcula estatísticas de engajamento e horas jogadas segmentadas por sentimento."""
    rows = session.execute(
        apply_filters(
            select(
                Review.recommended.label("recommended"),
                func.count().label("n"),
                func.avg(Review.votes_helpful).label("avg_helpful"),
                func.max(Review.votes_helpful).label("max_helpful"),
                func.avg(Review.votes_funny).label("avg_funny"),
                func.avg(Review.comment_count).label("avg_comments"),
                func.avg(Review.playtime_at_review).label("avg_playtime_min"),
                func.avg(func.length(Review.excerpt)).label("avg_excerpt_len"),
            ).group_by(Review.recommended),
            filters,
        )
    ).all()

    pos = _empty_engagement_bucket()
    neg = _empty_engagement_bucket()

    total_n = 0
    sum_helpful = 0.0
    max_helpful = 0
    sum_funny = 0.0
    sum_comments = 0.0
    sum_playtime_weighted = 0.0
    playtime_weight = 0
    sum_excerpt_len = 0.0

    for row in rows:
        count = int(row.n or 0)
        if count == 0:
            continue
        avg_helpful = float(row.avg_helpful or 0.0)
        row_max_helpful = int(row.max_helpful or 0)
        avg_funny = float(row.avg_funny or 0.0)
        avg_comments = float(row.avg_comments or 0.0)
        avg_playtime_hours = (
            round(float(row.avg_playtime_min) / 60.0, 2)
            if row.avg_playtime_min is not None
            else None
        )
        avg_excerpt_chars = float(row.avg_excerpt_len or 0.0)

        bucket_data = {
            "review_count": count,
            "avg_votes_helpful": round(avg_helpful, 2),
            "max_votes_helpful": row_max_helpful,
            "avg_votes_funny": round(avg_funny, 2),
            "avg_comment_count": round(avg_comments, 2),
            "avg_playtime_hours": avg_playtime_hours,
            "avg_excerpt_chars": round(avg_excerpt_chars, 1),
        }
        if bool(row.recommended):
            pos = bucket_data
        else:
            neg = bucket_data

        total_n += count
        sum_helpful += avg_helpful * count
        max_helpful = max(max_helpful, row_max_helpful)
        sum_funny += avg_funny * count
        sum_comments += avg_comments * count
        sum_excerpt_len += avg_excerpt_chars * count
        if row.avg_playtime_min is not None:
            sum_playtime_weighted += float(row.avg_playtime_min) * count
            playtime_weight += count

    overall = (
        {
            "review_count": total_n,
            "avg_votes_helpful": round(sum_helpful / total_n, 2),
            "max_votes_helpful": max_helpful,
            "avg_votes_funny": round(sum_funny / total_n, 2),
            "avg_comment_count": round(sum_comments / total_n, 2),
            "avg_playtime_hours": (
                round((sum_playtime_weighted / playtime_weight) / 60.0, 2)
                if playtime_weight > 0
                else None
            ),
            "avg_excerpt_chars": round(sum_excerpt_len / total_n, 1),
        }
        if total_n > 0
        else _empty_engagement_bucket()
    )

    helpful_ratio = (
        round(neg["avg_votes_helpful"] / pos["avg_votes_helpful"], 2)
        if pos["avg_votes_helpful"] > 0 and neg["review_count"] > 0
        else None
    )
    excerpt_ratio = (
        round(neg["avg_excerpt_chars"] / pos["avg_excerpt_chars"], 2)
        if pos["avg_excerpt_chars"] > 0 and neg["review_count"] > 0
        else None
    )

    return {
        "applied_filters": filters.model_dump(exclude_none=True),
        "overall": overall,
        "positive": pos,
        "negative": neg,
        "helpful_ratio_neg_vs_pos": helpful_ratio,
        "excerpt_length_ratio_neg_vs_pos": excerpt_ratio,
    }


def compare_slices(
    session: Session,
    label_a: str,
    filters_a: ReviewFilters,
    label_b: str,
    filters_b: ReviewFilters,
) -> dict[str, Any]:
    """Compara métricas de volume, aprovação e engajamento entre dois recortes A e B."""
    m_a = metrics(session, filters_a)
    m_b = metrics(session, filters_b)
    e_a = get_engagement_stats(session, filters_a)
    e_b = get_engagement_stats(session, filters_b)

    rate_a_pct = round(m_a.recommendation_rate * 100.0, 2)
    rate_b_pct = round(m_b.recommendation_rate * 100.0, 2)

    play_a = e_a["overall"]["avg_playtime_hours"]
    play_b = e_b["overall"]["avg_playtime_hours"]
    play_diff = round(play_a - play_b, 2) if play_a is not None and play_b is not None else None

    vol_ratio = (
        round(m_a.total_reviews / m_b.total_reviews, 2)
        if m_b.total_reviews > 0
        else None
    )

    return {
        "slice_a": {
            "label": label_a,
            "applied_filters": filters_a.model_dump(exclude_none=True),
            "total_reviews": m_a.total_reviews,
            "recommendation_rate": round(m_a.recommendation_rate, 4),
            "approval_pct": rate_a_pct,
            "game_count": m_a.game_count,
            "author_count": m_a.author_count,
            "avg_votes_helpful": e_a["overall"]["avg_votes_helpful"],
            "avg_playtime_hours": play_a,
        },
        "slice_b": {
            "label": label_b,
            "applied_filters": filters_b.model_dump(exclude_none=True),
            "total_reviews": m_b.total_reviews,
            "recommendation_rate": round(m_b.recommendation_rate, 4),
            "approval_pct": rate_b_pct,
            "game_count": m_b.game_count,
            "author_count": m_b.author_count,
            "avg_votes_helpful": e_b["overall"]["avg_votes_helpful"],
            "avg_playtime_hours": play_b,
        },
        "deltas": {
            "approval_delta_pp": round(rate_a_pct - rate_b_pct, 2),
            "review_count_diff": m_a.total_reviews - m_b.total_reviews,
            "review_volume_ratio": vol_ratio,
            "helpful_votes_diff": round(
                e_a["overall"]["avg_votes_helpful"] - e_b["overall"]["avg_votes_helpful"],
                2,
            ),
            "avg_playtime_hours_diff": play_diff,
        },
        "chart": {
            "kind": "comparison_bar",
            "categories": [label_a, label_b],
            "approval_pct": [rate_a_pct, rate_b_pct],
            "review_counts": [m_a.total_reviews, m_b.total_reviews],
        },
    }
