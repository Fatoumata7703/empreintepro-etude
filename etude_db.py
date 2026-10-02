import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("ETUDE_DB", str(Path(__file__).resolve().parent / "instance" / "etude.db")))
DATABASE_URL = (os.environ.get("DATABASE_URL") or "").strip()

LABELS = {
    "role": {
        "dirigeant": "Dirigeant / gérant",
        "admin": "Administration / RH",
        "securite": "Sécurité / maintenance",
        "proprio": "Propriétaire / particulier",
        "autre": "Autre",
    },
    "org_type": {
        "pme": "PME / bureau",
        "ecole": "École / formation",
        "commerce": "Commerce / boutique",
        "entrepot": "Entrepôt / dépôt (pro ou perso)",
        "particulier": "Particulier / maison",
        "cabinet": "Cabinet / clinique",
        "cowork": "Coworking / immeuble",
        "autre": "Autre",
    },
    "moyen": {
        "cles": "Clés",
        "badges": "Badges / cartes",
        "codes": "Codes / digicode",
        "vigile": "Vigile / registre",
        "empreinte": "Empreinte déjà en place",
        "rien": "Rien de formalisé",
    },
    "concurrent": {
        "zkteco": "ZKTeco",
        "hikvision": "Hikvision",
        "suprema": "Suprema",
        "local": "Installateur / marque locale",
        "autre": "Autre",
        "aucun": "Aucune en particulier",
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
        "proprio": "Propriétaire / particulier",
        "famille": "Famille / proches",
        "maison": "Personnel de maison / gardien",
    },
    "decideur": {
        "moi": "Moi, je décide",
        "associe": "Avec un associé / la famille",
        "siege": "Un responsable au-dessus",
        "conseil": "Plusieurs décideurs",
        "nsp": "Pas encore clair",
    },
    "ailleurs": {
        "oui": "Oui, déjà vu",
        "proche": "Quelque chose de proche",
        "non": "Non, jamais",
        "nsp": "Je ne sais pas",
    },
    "abonnement": {
        "oui": "OK, abonnement au mois",
        "selon": "OK, selon le montant",
        "achat": "OK, préfère payer une année d’avance",
        "non": "Le prix de l’abonnement me gêne (mais il reste obligatoire)",
        "nsp": "Je ne sais pas encore",
    },
    "interet": {
        "oui": "Oui, clairement",
        "peut": "Oui, selon les prix",
        "plus": "Intéressant, plus tard",
        "non": "Non",
    },
    "frein": {
        "prix": "Le prix",
        "confiance": "Données biométriques",
        "panne": "Peur de la panne",
        "complexe": "Trop complexe",
        "existant": "Système déjà en place",
    },
    "budget": {
        "lt100": "Moins de 100 000 FCFA (installation)",
        "100_300": "100 000 à 300 000 FCFA (installation)",
        "300_500": "300 000 à 500 000 FCFA (installation)",
        "plus500": "Plus de 500 000 FCFA (installation)",
        "nsp": "Je ne sais pas encore",
    },
    "urgence": {
        "maintenant": "Maintenant / très bientôt",
        "6mois": "Dans les 6 mois",
        "plus_tard": "Plus tard",
        "curiosite": "Juste de la curiosité",
    },
    "pilote": {
        "ouvert": "Oui, essayer chez moi / chez nous",
        "voir": "Oui, d’abord une démo",
        "budget": "Peut-être, si c’est simple",
        "non": "Pas pour le moment",
    },
    "taille": {
        "1 à 5 (foyer / petit site)": "1 à 5",
        "6 à 10": "6 à 10",
        "1 à 10": "1 à 10",
        "11 à 30": "11 à 30",
        "31 à 80": "31 à 80",
        "Plus de 80": "Plus de 80",
    },
    "portes": {
        "1": "1 porte",
        "2 à 4": "2 à 4",
        "5 à 10": "5 à 10",
        "Plus de 10": "Plus de 10",
    },
    "zone": {
        "Plateau": "Plateau",
        "Médina / Gueule Tapée": "Médina / Gueule Tapée",
        "Almadies / Ngor / Ouakam": "Almadies / Ngor / Ouakam",
        "Mermoz / Sacré-Cœur / Fann": "Mermoz / Sacré-Cœur / Fann",
        "Parcelles Assainies / Grand Yoff": "Parcelles / Grand Yoff",
        "Pikine / Guédiawaye": "Pikine / Guédiawaye",
        "Rufisque / Diamniadio": "Rufisque / Diamniadio",
        "Autre commune de Dakar": "Autre commune de Dakar",
        "Hors région de Dakar": "Hors région de Dakar",
    },
}

COLUMNS = [
    "created_at", "role", "org_type", "taille", "zone", "moyens", "portes",
    "douleurs", "incident", "priorite", "qui", "interet", "freins", "pilote",
    "nom", "tel", "fin", "concurrents", "decideur", "budget", "urgence",
    "ailleurs", "abonnement",
]


def _use_postgres() -> bool:
    return bool(DATABASE_URL)


def _pg_url() -> str:
    url = DATABASE_URL
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


class _PgConn:
    def __init__(self, raw):
        self.raw = raw

    def execute(self, sql, params=None):
        sql = sql.replace("?", "%s")
        sql = re.sub(r"INSERT OR IGNORE", "INSERT", sql, flags=re.I)
        cur = self.raw.cursor()
        cur.execute(sql, params or ())
        return cur

    def commit(self):
        self.raw.commit()

    def close(self):
        self.raw.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            self.raw.rollback()
        else:
            self.raw.commit()
        self.raw.close()


def connect():
    if _use_postgres():
        import psycopg2
        import psycopg2.extras

        raw = psycopg2.connect(_pg_url(), cursor_factory=psycopg2.extras.RealDictCursor)
        return _PgConn(raw)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_columns(conn):
    names = ("concurrents", "decideur", "budget", "urgence", "ailleurs", "abonnement")
    if _use_postgres():
        for name in names:
            conn.execute(f"ALTER TABLE responses ADD COLUMN IF NOT EXISTS {name} TEXT")
        return

    existing = {row[1] for row in conn.execute("PRAGMA table_info(responses)").fetchall()}
    for name in names:
        if name not in existing:
            conn.execute(f"ALTER TABLE responses ADD COLUMN {name} TEXT")


def init_db():
    with connect() as conn:
        if _use_postgres():
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS responses (
                    id SERIAL PRIMARY KEY,
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
                    fin TEXT,
                    concurrents TEXT,
                    decideur TEXT,
                    budget TEXT,
                    urgence TEXT,
                    ailleurs TEXT,
                    abonnement TEXT
                )
                """
            )
        else:
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
                    fin TEXT,
                    concurrents TEXT,
                    decideur TEXT,
                    budget TEXT,
                    urgence TEXT,
                    ailleurs TEXT,
                    abonnement TEXT
                )
                """
            )
        _ensure_columns(conn)
        # Mounta restore: chart blue matches legend "6 à 10", not 11–30.
        conn.execute(
            "UPDATE responses SET taille = ? WHERE nom = ? AND taille = ?",
            ("6 à 10", "Mounta", "11 à 30"),
        )
        conn.commit()


def delete_response(response_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM responses WHERE id = ?", (response_id,))
        conn.commit()
        return cur.rowcount > 0


def purge_auto_tests() -> int:
    with connect() as conn:
        cur = conn.execute(
            """
            DELETE FROM responses
            WHERE (nom = ? AND (fin = ? OR incident = ?))
               OR (nom = ? AND fin = ?)
            """,
            (
                "Test Auto",
                "verification pipeline",
                "test connexion Auto",
                "Test Branchement",
                "verification formulaire-admin",
            ),
        )
        conn.commit()
        return cur.rowcount


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


def _row_get(row, key, default=""):
    try:
        value = row[key]
    except (IndexError, KeyError, TypeError):
        return default
    return default if value is None else value


def _multi_labels(row, field, group):
    keys = _load(_row_get(row, field))
    labels = LABELS.get(group, {})
    return [labels.get(k, k) for k in keys if k]


def _person_card(row):
    moyens = _multi_labels(row, "moyens", "moyen")
    douleurs = _multi_labels(row, "douleurs", "douleur")
    freins = _multi_labels(row, "freins", "frein")
    concurrents = _multi_labels(row, "concurrents", "concurrent")
    qui = _multi_labels(row, "qui", "qui")
    interet = _row_get(row, "interet") or ""
    pilote = _row_get(row, "pilote") or ""
    nom = _row_get(row, "nom") or ""
    tel = _row_get(row, "tel") or ""
    fin = (_row_get(row, "fin") or "").strip()
    incident = (_row_get(row, "incident") or "").strip()

    role = LABELS["role"].get(_row_get(row, "role"), _row_get(row, "role") or "—")
    org = LABELS["org_type"].get(_row_get(row, "org_type"), _row_get(row, "org_type") or "—")
    zone = _row_get(row, "zone") or "—"
    taille = _row_get(row, "taille") or "—"
    portes = LABELS["portes"].get(_row_get(row, "portes"), _row_get(row, "portes") or "—")
    priorite = LABELS["priorite"].get(_row_get(row, "priorite"), _row_get(row, "priorite") or "—")
    interet_label = LABELS["interet"].get(interet, interet or "—")
    pilote_label = LABELS["pilote"].get(pilote, pilote or "—")
    budget = LABELS["budget"].get(_row_get(row, "budget"), _row_get(row, "budget") or "—")
    urgence = LABELS["urgence"].get(_row_get(row, "urgence"), _row_get(row, "urgence") or "—")
    decideur = LABELS["decideur"].get(_row_get(row, "decideur"), _row_get(row, "decideur") or "—")
    ailleurs = LABELS["ailleurs"].get(_row_get(row, "ailleurs"), _row_get(row, "ailleurs") or "—")
    abonnement = LABELS["abonnement"].get(_row_get(row, "abonnement"), _row_get(row, "abonnement") or "—")

    bits = [
        f"{nom or 'Anonyme'} — {role} ({org}, {zone}).",
        f"Site : {taille} personnes, {portes}.",
    ]
    if moyens:
        bits.append("Accès actuel : " + ", ".join(moyens) + ".")
    if douleurs:
        bits.append("Problèmes : " + ", ".join(douleurs) + ".")
    bits.append(f"Priorité : {priorite}.")
    if qui:
        bits.append("Doivent pouvoir ouvrir : " + ", ".join(qui) + ".")
    bits.append(f"Intérêt EmpreintePro : {interet_label}. Suite : {pilote_label}.")
    bits.append(f"Installation (budget) : {budget}. Abonnement plateforme (enrôlement / droits) : {abonnement}.")
    bits.append(f"Urgence : {urgence}. Décideur : {decideur}. Vu ailleurs : {ailleurs}.")
    if concurrents:
        bits.append("Concurrents connus : " + ", ".join(concurrents) + ".")
    if freins:
        bits.append("Freins : " + ", ".join(freins) + ".")
    if incident:
        bits.append(f"Cas concret : {incident}")
    if fin:
        bits.append(f"Mot libre : {fin}")

    return {
        "id": _row_get(row, "id"),
        "created_at": _row_get(row, "created_at"),
        "nom": nom,
        "tel": tel,
        "role": role,
        "org_type": org,
        "taille": taille,
        "zone": zone,
        "portes": portes,
        "moyens": moyens,
        "douleurs": douleurs,
        "priorite": priorite,
        "qui": qui,
        "interet": interet,
        "interet_label": interet_label,
        "pilote": pilote_label,
        "freins": freins,
        "concurrents": concurrents,
        "budget": budget,
        "urgence": urgence,
        "decideur": decideur,
        "ailleurs": ailleurs,
        "abonnement": abonnement,
        "incident": incident,
        "fin": fin,
        "resume": " ".join(bits),
        "hot": interet == "oui" or pilote == "ouvert",
    }


def save_response(payload):
    now = datetime.now(timezone.utc).isoformat()
    values = (
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
        _dump(payload.get("concurrents")),
        payload.get("decideur") or "",
        payload.get("budget") or "",
        payload.get("urgence") or "",
        payload.get("ailleurs") or "",
        payload.get("abonnement") or "",
    )
    with connect() as conn:
        _ensure_columns(conn)
        if _use_postgres():
            cur = conn.execute(
                """
                INSERT INTO responses (
                    created_at, role, org_type, taille, zone, moyens, portes,
                    douleurs, incident, priorite, qui, interet, freins, pilote,
                    nom, tel, fin, concurrents, decideur, budget, urgence,
                    ailleurs, abonnement
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                values,
            )
            row = cur.fetchone()
            conn.commit()
            return int(row["id"] if isinstance(row, dict) else row[0])

        cur = conn.execute(
            """
            INSERT INTO responses (
                created_at, role, org_type, taille, zone, moyens, portes,
                douleurs, incident, priorite, qui, interet, freins, pilote,
                nom, tel, fin, concurrents, decideur, budget, urgence,
                ailleurs, abonnement
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            values,
        )
        conn.commit()
        return cur.lastrowid


def _count_map(rows, field, keys):
    counts = {key: 0 for key in keys}
    for row in rows:
        value = _row_get(row, field)
        if value in counts:
            counts[value] += 1
    return counts


def _count_multi(rows, field, keys):
    counts = {key: 0 for key in keys}
    for row in rows:
        for value in _load(_row_get(row, field)):
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
        _ensure_columns(conn)
        cur = conn.execute("SELECT * FROM responses ORDER BY id DESC")
        rows = cur.fetchall()

    total = len(rows)
    interest_yes = sum(1 for r in rows if _row_get(r, "interet") == "oui")
    interest_maybe = sum(1 for r in rows if _row_get(r, "interet") in ("oui", "peut"))
    pilot_open = sum(1 for r in rows if _row_get(r, "pilote") == "ouvert")
    with_contact = sum(1 for r in rows if (_row_get(r, "nom") or _row_get(r, "tel")))

    leads = []
    recent = []
    for row in rows:
        item = _person_card(row)
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
            "concurrents": _labeled(_count_multi(rows, "concurrents", LABELS["concurrent"]), "concurrent"),
            "douleurs": _labeled(_count_multi(rows, "douleurs", LABELS["douleur"]), "douleur"),
            "priorite": _labeled(_count_map(rows, "priorite", LABELS["priorite"]), "priorite"),
            "interet": _labeled(_count_map(rows, "interet", LABELS["interet"]), "interet"),
            "freins": _labeled(_count_multi(rows, "freins", LABELS["frein"]), "frein"),
            "budget": _labeled(_count_map(rows, "budget", LABELS["budget"]), "budget"),
            "urgence": _labeled(_count_map(rows, "urgence", LABELS["urgence"]), "urgence"),
            "decideur": _labeled(_count_map(rows, "decideur", LABELS["decideur"]), "decideur"),
            "ailleurs": _labeled(_count_map(rows, "ailleurs", LABELS["ailleurs"]), "ailleurs"),
            "abonnement": _labeled(_count_map(rows, "abonnement", LABELS["abonnement"]), "abonnement"),
            "pilote": _labeled(_count_map(rows, "pilote", LABELS["pilote"]), "pilote"),
            "role": _labeled(_count_map(rows, "role", LABELS["role"]), "role"),
            "taille": _labeled(_count_map(rows, "taille", LABELS["taille"]), "taille"),
            "zone": _labeled(_count_map(rows, "zone", LABELS["zone"]), "zone"),
            "portes": _labeled(_count_map(rows, "portes", LABELS["portes"]), "portes"),
            "qui": _labeled(_count_multi(rows, "qui", LABELS["qui"]), "qui"),
        },
        "leads": leads[:20],
        "recent": recent[:50],
        "storage": "postgres" if _use_postgres() else "sqlite",
    }


def export_rows():
    with connect() as conn:
        _ensure_columns(conn)
        return conn.execute("SELECT * FROM responses ORDER BY id DESC").fetchall()
