import re

# votes_funny chega como uint32; underflow volta como valor >= 2**32 - 4.
_VOTES_FUNNY_UNDERFLOW = 4_294_967_292
_EXCERPT_LIMIT = 280
_WHITESPACE = re.compile(r"\s+")
_TRUE_VALUES = {"true", "1", "yes"}

# Limites em minutos: (inclusivo ou None, exclusivo ou None).
PLAYTIME_BUCKETS: dict[str, tuple[int | None, int | None]] = {
    "lt1": (None, 60),
    "h1_2": (60, 120),
    "h2_5": (120, 300),
    "h5_10": (300, 600),
    "h10_25": (600, 1500),
    "h25_50": (1500, 3000),
    "h50_100": (3000, 6000),
    "h100_500": (6000, 30000),
    "gte500": (30000, None),
}

PLAYTIME_LABELS: dict[str, str] = {
    "lt1": "<1 h",
    "h1_2": "1–2 h",
    "h2_5": "2–5 h",
    "h5_10": "5–10 h",
    "h10_25": "10–25 h",
    "h25_50": "25–50 h",
    "h50_100": "50–100 h",
    "h100_500": "100–500 h",
    "gte500": "500+ h",
}


def parse_bool(value: str) -> bool:
    if value is None:
        return False
    return value.strip().lower() in _TRUE_VALUES


def parse_optional_float(value: str) -> float | None:
    if value is None:
        return None
    text = value.strip()
    if text == "":
        return None
    return float(text)


def clean_votes_funny(value: str) -> int:
    parsed = int(float(value))
    if parsed >= _VOTES_FUNNY_UNDERFLOW:
        return 0
    return parsed


def make_excerpt(text: str) -> str:
    if not text:
        return ""
    collapsed = _WHITESPACE.sub(" ", text).strip()
    return collapsed[:_EXCERPT_LIMIT]
