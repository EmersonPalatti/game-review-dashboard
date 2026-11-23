import os
from pathlib import Path

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def read_dotenv_var(name: str, env_path: Path = _ENV_PATH) -> str:
    """Lê uma variável do arquivo .env na raiz do projeto caso não esteja no os.environ."""
    if not env_path.is_file():
        return ""
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            if key.startswith("export "):
                key = key[len("export ") :].strip()
            if key == name:
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                    val = val[1:-1]
                return val.strip()
    except Exception:
        return ""
    return ""


def get_config_var(name: str, default: str = "") -> str:
    """Obtém variável de os.environ ou, durante desenvolvimento local, do arquivo .env."""
    val = os.getenv(name, "").strip()
    if val:
        return val
    # Não lê o .env real quando estiver rodando suíte do pytest
    if os.getenv("PYTEST_CURRENT_TEST"):
        return default
    dotenv_val = read_dotenv_var(name)
    return dotenv_val if dotenv_val else default
