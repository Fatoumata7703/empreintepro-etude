import os
from functools import wraps
from pathlib import Path

from flask import Flask, Response, jsonify, redirect, render_template, request, session, url_for

from etude_db import export_rows, init_db, purge_auto_tests, save_response, stats

BASE = Path(__file__).resolve().parent
ADMIN_PASSWORD = os.environ.get("ETUDE_ADMIN", "empreinte2026")

app = Flask(
    __name__,
    template_folder=str(BASE / "templates"),
    static_folder=str(BASE / "static"),
    static_url_path="/static",
)
app.secret_key = os.environ.get("ETUDE_SECRET", "empreintepro-etude-locale")

init_db()


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("etude_admin"):
            if request.path.startswith("/api/"):
                return jsonify({"ok": False}), 401
            return redirect(url_for("etude_login"))
        return view(*args, **kwargs)

    return wrapped


@app.route("/")
def etude_de_marche():
    return render_template("questionnaire.html")


@app.route("/ping")
def etude_ping():
    return jsonify({"ok": True}), 200


@app.route("/docs")
def etude_docs():
    return render_template("etude_docs.html")


@app.route("/merci")
def etude_merci():
    return render_template("etude_merci.html")


@app.route("/api/reponses", methods=["POST"])
def etude_save():
    data = request.get_json(silent=True) or {}
    org_type = (data.get("org_type") or "").strip()
    interet = (data.get("interet") or "").strip()
    if not org_type or not interet:
        return jsonify({"ok": False, "error": "Indiquez le type de lieu et si EmpreintePro vous parle."}), 400
    try:
        new_id = save_response(data)
    except Exception as exc:
        app.logger.exception("Échec enregistrement questionnaire")
        return jsonify({
            "ok": False,
            "error": "Enregistrement impossible pour le moment. Réessayez dans quelques secondes.",
            "detail": str(exc)[:200],
        }), 500
    if not new_id:
        return jsonify({"ok": False, "error": "Enregistrement sans numéro de réponse."}), 500
    return jsonify({
        "ok": True,
        "id": new_id,
        "redirect": url_for("etude_merci", n=new_id),
    })


@app.route("/admin", methods=["GET", "POST"])
def etude_login():
    if request.method == "GET":
        if session.get("etude_admin"):
            return redirect(url_for("etude_dashboard"))
        return render_template("etude_login.html", error=None)

    password = (request.form.get("password") or "").strip()
    if password == ADMIN_PASSWORD:
        session["etude_admin"] = True
        return redirect(url_for("etude_dashboard"))
    return render_template("etude_login.html", error="Mot de passe incorrect.")


@app.route("/admin/sortie")
def etude_logout():
    session.pop("etude_admin", None)
    return redirect(url_for("etude_de_marche"))


@app.route("/tableau")
@admin_required
def etude_dashboard():
    return render_template("etude_dashboard.html")


@app.route("/rapport")
@admin_required
def etude_rapport():
    return render_template("etude_rapport.html")


@app.route("/api/stats")
@admin_required
def etude_stats():
    return jsonify(stats())


@app.route("/api/export")
@admin_required
def etude_export():
    import csv
    import io

    rows = export_rows()
    buf = io.StringIO()
    writer = csv.writer(buf)
    headers = [
        "id", "created_at", "role", "org_type", "taille", "zone", "moyens", "portes",
        "douleurs", "incident", "priorite", "qui", "interet", "freins", "pilote",
        "nom", "tel", "fin", "concurrents", "decideur", "budget", "urgence",
        "ailleurs", "abonnement",
    ]
    writer.writerow(headers)
    for row in rows:
        writer.writerow([row[key] if key in row.keys() else "" for key in headers])
    data = "\ufeff" + buf.getvalue()
    return Response(
        data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=etude-empreintepro.csv"},
    )


@app.route("/api/purge-tests", methods=["POST"])
@admin_required
def etude_purge_tests():
    removed = purge_auto_tests()
    return jsonify({"ok": True, "removed": removed})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5002"))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print("\n  Étude de marché EmpreintePro")
    print(f"  Questionnaire -> http://127.0.0.1:{port}/")
    print(f"  Documentation -> http://127.0.0.1:{port}/docs")
    print(f"  Dashboard     -> http://127.0.0.1:{port}/admin")
    print(f"  Graphiques    -> http://127.0.0.1:{port}/rapport")
    print(f"  Mot de passe  -> (variable ETUDE_ADMIN)\n")
    app.run(debug=debug, host="0.0.0.0", port=port)
