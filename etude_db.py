import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("ETUDE_DB", str(Path(__file__).resolve().parent / "instance" / "etude.db")))

LABELS = {
    "role": {
        "dirigeant": "Dirigeant / gérant",
        "admin": "Administration / RH",
        "securite": "Sécurité / maintenance",
        "autre": "Autre",
    },
    "org_type": {
        "pme": "PME / bureau",
        "ecole": "École / formation",
        "commerce": "Commerce / boutique",
        "entrepot": "Entrepôt / dépôt",
        "cabinet": "Cabinet / clinique",
        "cowork": "Coworking / immeuble",
    },
    "moyen": {
        "cles": "Clés",
        "badges": "Badges / cartes",
        "codes": "Codes / digicode",
        "vigile": "Vigile / registre",
        "empreinte": "Empreinte déjà en place",
        "rien": "Rien de formalisé",
    },
    "douleur": {
        "pertes": "Clés ou badges perdus",
        "codes": "Codes trop partagés",
        "trace": "Pas de traçabilité",
        "depart": "Droit non retiré au départ",
        "temps": "Trop long à gérer",
        "rien": "Pas de problème",
    },
    "priorite": {
        "securite": "Sécuriser",
        "gerer": "Gérer les droits",
        "tracer": "Tracer les accès",
        "simple": "Rester simple",
    },
    "qui": {
        "salaries": "Salariés",
        "temps": "Personnel temporaire",
        "visiteurs": "Visiteurs / prestataires",
        "direction": "Direction seulement",
    },
    "interet": {
        "oui": "Oui, clairement",
        "peut": "Peut-être, selon le prix",
        "plus": "Intéressant, plus tard",
        "non": "Non, pas pour nous",
    },
    "frein": {
        "prix": "Le prix",
        "confiance": "Données biométriques",
        "panne": "Peur de la panne",
        "complexe": "Trop complexe",
        "existant": "Système déjà en place",
    },
    "pilote": {
        "ouvert": "Oui, essayer chez nous",
        "voir": "Oui, d’abord une démo",
        "budget": "Peut-être, si c’est simple",
        "non": "Pas pour le moment",
    },
}


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                role TEXT,
                org_type TEXT,
                taille TEXT,
                zone TEXT,
                moyens TEXT,
                portes TEXT,
                douleurs TEXT,
                incident TEXT,
                priorite TEXT,
                qui TEXT,
                interet TEXT,
                freins TEXT,
                pilote TEXT,
                nom TEXT,
                tel TEXT,
                fin TEXT
            )
            """
        )
        conn.commit()


def _dump(value):
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    return json.dumps(value or [], ensure_ascii=False)


def _load(raw):
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_response(payload):
    now = datetime.now(timezone.utc).isoformat()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO responses (
                created_at, role, org_type, taille, zone, moyens, portes,
                douleurs, incident, priorite, qui, interet, freins, pilote,
                nom, tel, fin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now,
                payload.get("role") or "",
                payload.get("org_type") or "",
                payload.get("taille") or "",
                payload.get("zone") or "",
                _dump(payload.get("moyens")),
                payload.get("portes") or "",
                _dump(payload.get("douleurs")),
                (payload.get("incident") or "").strip(),
                payload.get("priorite") or "",
                _dump(payload.get("qui")),
                payload.get("interet") or "",
                _dump(payload.get("freins")),
                payload.get("pilote") or "",
                (payload.get("nom") or "").strip()[:120],
                (payload.get("tel") or "").strip()[:40],
                (payload.get("fin") or "").strip()[:800],
            ),
        )
        conn.commit()
        return cur.lastrowid


def _count_map(rows, field, keys):
    counts = {key: 0 for key in keys}
    for row in rows:
        value = row[field]
        if value in counts:
            counts[value] += 1
    return counts


def _count_multi(rows, field, keys):
    counts = {key: 0 for key in keys}
    for row in rows:
        for value in _load(row[field]):
            if value in counts:
                counts[value] += 1
    return counts


def _labeled(counts, group):
    labels = LABELS[group]
    return {
        "labels": [labels[key] for key in counts],
        "values": list(counts.values()),
        "keys": list(counts.keys()),
    }


def stats():
    with connect() as conn:
        rows = conn.execute("SELECT * FROM responses ORDER BY id DESC").fetchall()

    total = len(rows)
    interest_yes = sum(1 for r in rows if r["interet"] == "oui")
    interest_maybe = sum(1 for r in rows if r["interet"] in ("oui", "peut"))
    pilot_open = sum(1 for r in rows if r["pilote"] == "ouvert")
    with_contact = sum(1 for r in rows if (r["nom"] or r["tel"]))

    leads = []
    recent = []
    for row in rows:
        item = {
            "id": row["id"],
            "created_at": row["created_at"],
            "role": LABELS["role"].get(row["role"], row["role"] or "—"),
            "org_type": LABELS["org_type"].get(row["org_type"], row["org_type"] or "—"),
            "taille": row["taille"] or "—",
            "zone": row["zone"] or "—",
            "interet": row["interet"] or "",
            "interet_label": LABELS["interet"].get(row["interet"], row["interet"] or "—"),
            "pilote": LABELS["pilote"].get(row["pilote"], row["pilote"] or "—"),
            "priorite": LABELS["priorite"].get(row["priorite"], row["priorite"] or "—"),
            "nom": row["nom"] or "",
            "tel": row["tel"] or "",
            "incident": row["incident"] or "",
            "fin": row["fin"] or "",
            "hot": row["interet"] == "oui" or row["pilote"] == "ouvert",
        }
        recent.append(item)
        if item["hot"]:
            leads.append(item)

    return {
        "total": total,
        "interest_yes": interest_yes,
        "interest_maybe": interest_maybe,
        "pilot_open": pilot_open,
        "with_contact": with_contact,
        "pct_yes": round(100 * interest_yes / total) if total else 0,
        "pct_warm": round(100 * interest_maybe / total) if total else 0,
        "charts": {
            "org_type": _labeled(_count_map(rows, "org_type", LABELS["org_type"]), "org_type"),
            "moyens": _labeled(_count_multi(rows, "moyens", LABELS["moyen"]), "moyen"),
            "douleurs": _labeled(_count_multi(rows, "douleurs", LABELS["douleur"]), "douleur"),
            "priorite": _labeled(_count_map(rows, "priorite", LABELS["priorite"]), "priorite"),
            "interet": _labeled(_count_map(rows, "interet", LABELS["interet"]), "interet"),
            "freins": _labeled(_count_multi(rows, "freins", LABELS["frein"]), "frein"),
            "pilote": _labeled(_count_map(rows, "pilote", LABELS["pilote"]), "pilote"),
        },
        "leads": leads[:20],
        "recent": recent[:50],
    }
