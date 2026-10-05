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
        "codes": "Codes (digicode)",
        "vigile": "Vigile / gardien",
        "empreinte": "Déjà avec le doigt (empreinte)",
        "rien": "Rien de précis",
    },
    "concurrent": {
        "zkteco": "ZKTeco",
        "hikvision": "Hikvision",
        "suprema": "Suprema",
        "local": "Installateur / marque locale",
        "autre": "Autre",
        "aucun": "Aucune — je ne connais pas",
    },
    "douleur": {
        "pertes": "Clés ou badges perdus / prêtés",
        "codes": "Codes trop partagés",
        "trace": "On ne sait pas qui est entré ni quand",
        "depart": "Une personne partie peut encore entrer",
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
        "mois": "Chaque mois",
        "semestre": "Tous les 6 mois",
        "an": "Une fois par an",
    },
    "interet": {
        "oui": "Oui",
        "peut": "Selon le prix",
        "plus": "Intéressant, plus tard",
        "non": "Non",
    },
    "frein": {
        "prix": "Le prix",
        "confiance": "Enregistrer mon empreinte (mon doigt)",
        "panne": "Peur que la porte reste bloquée",
        "complexe": "Trop compliqué à utiliser",
        "existant": "J’ai déjà un système",
    },
    "budget": {
        "lt100": "Moins de 100 000 F (matériel + pose)",
        "100_300": "100 000 à 300 000 F (matériel + pose)",
        "300_500": "300 000 à 500 000 F (matériel + pose)",
        "plus500": "Plus de 500 000 F (matériel + pose)",
        "nsp": "Je ne sais pas encore",
    },
    "urgence": {
        "maintenant": "Maintenant / très bientôt",
        "6mois": "Dans les 6 mois",
        "plus_tard": "Plus tard",
        "curiosite": "Juste de la curiosité",
    },
    "pilote": {
        "ouvert": "Essayer chez moi",
        "voir": "Voir d’abord une démonstration",
        "budget": "Peut-être plus tard",
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

ABONNEMENT_ALIASES = {
    "oui": "mois",
    "achat": "an",
}


def _abonnement_key(value):
    raw = value or ""
    return ABONNEMENT_ALIASES.get(raw, raw)


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
        self._closed = False

    def execute(self, sql, params=None):
        sql = sql.replace("?", "%s")
        sql = re.sub(r"INSERT OR IGNORE", "INSERT", sql, flags=re.I)
        cur = self.raw.cursor()
        cur.execute(sql, params or ())
        return cur

    def commit(self):
        self.raw.commit()

    def rollback(self):
        self.raw.rollback()

    def close(self):
        if not self._closed:
            self._closed = True
            self.raw.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type:
                self.raw.rollback()
            else:
                self.raw.commit()
        finally:
            self.close()


def connect():
    if _use_postgres():
        import psycopg2
        import psycopg2.extras

        raw = psycopg2.connect(
            _pg_url(),
            cursor_factory=psycopg2.extras.RealDictCursor,
            connect_timeout=10,
        )
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


def _budget_keys(row):
    raw = _row_get(row, "budget")
    keys = _load(raw)
    if keys:
        return keys
    if raw:
        return [raw]
    return []


def _budget_labels(row):
    labels = LABELS["budget"]
    return [labels.get(k, k) for k in _budget_keys(row) if k]


def _person_card(row):
    moyens = _multi_labels(row, "moyens", "moyen")
    douleurs = _multi_labels(row, "douleurs", "douleur")
    freins = _multi_labels(row, "freins", "frein")
    concurrents = _multi_labels(row, "concurrents", "concurrent")
    qui = _multi_labels(row, "qui", "qui")
    budgets = _budget_labels(row)
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
    budget = ", ".join(budgets) if budgets else "—"
    urgence = LABELS["urgence"].get(_row_get(row, "urgence"), _row_get(row, "urgence") or "—")
    decideur = LABELS["decideur"].get(_row_get(row, "decideur"), _row_get(row, "decideur") or "—")
    ailleurs = LABELS["ailleurs"].get(_row_get(row, "ailleurs"), _row_get(row, "ailleurs") or "—")
    abo_raw = _row_get(row, "abonnement") or ""
    abonnement = LABELS["abonnement"].get(_abonnement_key(abo_raw), abo_raw or "—")

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
    bits.append(f"Tarifs installation : {budget}. Paiement abonnement : {abonnement}.")
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


def _as_list(value):
    if isinstance(value, list):
        return value
    if value is None or value == "":
        return []
    return [value]


def save_response(payload):
    """Enregistre une réponse et renvoie son id. Lève en cas d'échec."""
    if os.environ.get("RENDER") and not _use_postgres():
        raise RuntimeError("DATABASE_URL manquante sur Render — réponse non enregistrée.")

    now = datetime.now(timezone.utc).isoformat()
    values = (
        now,
        (payload.get("role") or "").strip(),
        (payload.get("org_type") or "").strip(),
        payload.get("taille") or "",
        (payload.get("zone") or "").strip(),
        _dump(_as_list(payload.get("moyens"))),
        payload.get("portes") or "",
        _dump(_as_list(payload.get("douleurs"))),
        (payload.get("incident") or "").strip(),
        payload.get("priorite") or "",
        _dump(_as_list(payload.get("qui"))),
        (payload.get("interet") or "").strip(),
        _dump(_as_list(payload.get("freins"))),
        payload.get("pilote") or "",
        (payload.get("nom") or "").strip()[:120],
        (payload.get("tel") or "").strip()[:40],
        (payload.get("fin") or "").strip()[:800],
        _dump(_as_list(payload.get("concurrents"))),
        payload.get("decideur") or "",
        _dump(_as_list(payload.get("budget"))),
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
            if not row:
                raise RuntimeError("INSERT Postgres sans id retourné.")
            new_id = int(row["id"] if isinstance(row, dict) else row[0])
            # Commit explicite avant sortie du with (évite perte si close foire).
            conn.commit()
            return new_id

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
        new_id = cur.lastrowid
        if not new_id:
            raise RuntimeError("INSERT SQLite sans id.")
        conn.commit()
        return new_id


def count_responses() -> int:
    with connect() as conn:
        cur = conn.execute("SELECT COUNT(*) AS n FROM responses")
        row = cur.fetchone()
        if row is None:
            return 0
        if isinstance(row, dict):
            return int(row.get("n") or 0)
        return int(row[0])


def _count_budget(rows):
    counts = {key: 0 for key in LABELS["budget"]}
    for row in rows:
        for value in _budget_keys(row):
            if value in counts:
                counts[value] += 1
    return counts


def _count_map(rows, field, keys, normalize=None):
    counts = {key: 0 for key in keys}
    for row in rows:
        value = _row_get(row, field)
        if normalize:
            value = normalize(value)
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


def _timeline(rows):
    by_day = {}
    for row in rows:
        raw = str(_row_get(row, "created_at") or "")
        day = raw[:10] if len(raw) >= 10 else ""
        if not day or day[0] == "-":
            continue
        bucket = by_day.setdefault(
            day,
            {"total": 0, "oui": 0, "peut": 0, "non": 0, "plus": 0, "contact": 0, "pilot": 0},
        )
        bucket["total"] += 1
        interet = _row_get(row, "interet") or ""
        if interet in ("oui", "peut", "non", "plus"):
            bucket[interet] += 1
        if _row_get(row, "nom") or _row_get(row, "tel"):
            bucket["contact"] += 1
        if _row_get(row, "pilote") == "ouvert":
            bucket["pilot"] += 1

    days = sorted(by_day.keys())
    cumulative = []
    run = 0
    for day in days:
        run += by_day[day]["total"]
        cumulative.append(run)

    return {
        "labels": days,
        "daily": [by_day[d]["total"] for d in days],
        "cumulative": cumulative,
        "oui": [by_day[d]["oui"] for d in days],
        "peut": [by_day[d]["peut"] for d in days],
        "non": [by_day[d]["non"] for d in days],
        "contact": [by_day[d]["contact"] for d in days],
        "pilot": [by_day[d]["pilot"] for d in days],
    }


def _funnel(total, interest_maybe, with_contact, pilot_open):
    return {
        "labels": [
            "Réponses",
            "Ouverts (oui + prix)",
            "Avec contact",
            "Essai chez eux",
        ],
        "values": [total, interest_maybe, with_contact, pilot_open],
    }


def stats():
    with connect() as conn:
        _ensure_columns(conn)
        cur = conn.execute("SELECT * FROM responses ORDER BY id DESC")
        rows = cur.fetchall()

    total = len(rows)
    interest_yes = sum(1 for r in rows if _row_get(r, "interet") == "oui")
    interest_maybe = sum(1 for r in rows if _row_get(r, "interet") in ("oui", "peut"))
    interest_no = sum(1 for r in rows if _row_get(r, "interet") == "non")
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
        "storage": "postgres" if _use_postgres() else "sqlite",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "interest_yes": interest_yes,
        "interest_maybe": interest_maybe,
        "interest_no": interest_no,
        "pilot_open": pilot_open,
        "with_contact": with_contact,
        "pct_yes": round(100 * interest_yes / total) if total else 0,
        "pct_warm": round(100 * interest_maybe / total) if total else 0,
        "pct_contact": round(100 * with_contact / total) if total else 0,
        "timeline": _timeline(rows),
        "funnel": _funnel(total, interest_maybe, with_contact, pilot_open),
        "charts": {
            "org_type": _labeled(_count_map(rows, "org_type", LABELS["org_type"]), "org_type"),
            "moyens": _labeled(_count_multi(rows, "moyens", LABELS["moyen"]), "moyen"),
            "concurrents": _labeled(_count_multi(rows, "concurrents", LABELS["concurrent"]), "concurrent"),
            "douleurs": _labeled(_count_multi(rows, "douleurs", LABELS["douleur"]), "douleur"),
            "priorite": _labeled(_count_map(rows, "priorite", LABELS["priorite"]), "priorite"),
            "interet": _labeled(_count_map(rows, "interet", LABELS["interet"]), "interet"),
            "freins": _labeled(_count_multi(rows, "freins", LABELS["frein"]), "frein"),
            "budget": _labeled(_count_budget(rows), "budget"),
            "urgence": _labeled(_count_map(rows, "urgence", LABELS["urgence"]), "urgence"),
            "decideur": _labeled(_count_map(rows, "decideur", LABELS["decideur"]), "decideur"),
            "ailleurs": _labeled(_count_map(rows, "ailleurs", LABELS["ailleurs"]), "ailleurs"),
            "abonnement": _labeled(
                _count_map(rows, "abonnement", LABELS["abonnement"], _abonnement_key),
                "abonnement",
            ),
            "pilote": _labeled(_count_map(rows, "pilote", LABELS["pilote"]), "pilote"),
            "role": _labeled(_count_map(rows, "role", LABELS["role"]), "role"),
            "taille": _labeled(_count_map(rows, "taille", LABELS["taille"]), "taille"),
            "zone": _labeled(_count_map(rows, "zone", LABELS["zone"]), "zone"),
            "portes": _labeled(_count_map(rows, "portes", LABELS["portes"]), "portes"),
            "qui": _labeled(_count_multi(rows, "qui", LABELS["qui"]), "qui"),
        },
        "leads": leads[:40],
        "recent": recent,
    }


def export_rows():
    with connect() as conn:
        _ensure_columns(conn)
        return conn.execute("SELECT * FROM responses ORDER BY id DESC").fetchall()
