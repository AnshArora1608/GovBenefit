"""CLI wrapper: reads one JSON profile on stdin, prints a JSON array on stdout.

    echo '{"state":"Rajasthan","gender":"female","social_cat":"OBC"}' | python recommend_cli.py
"""
import contextlib
import io
import json
import sys

# importing recommend loads the CSV + models; keep any import-time prints off stdout
with contextlib.redirect_stdout(io.StringIO()):
    from recommend import recommend


def main():
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            raise ValueError("No input received")
        data = json.loads(raw)

        result = recommend(
            state=data.get("state", ""),
            gender=data.get("gender", "male"),
            social_cat=data.get("social_cat", "General"),
            minority=bool(data.get("minority", False)),
            disability=bool(data.get("disability", False)),
            bpl=bool(data.get("bpl", False)),
            ex_serviceman=bool(data.get("ex_serviceman", False)),
            age=int(data.get("age", 30)),
            income=float(data.get("income", 200000)),
            need=data.get("need", "loan subsidy to start small business"),
            top=int(data.get("top", 5)),
            entrepreneur_only=bool(data.get("entrepreneur_only", True)),
        )
        # to_json writes NaN as null (json.dumps would emit invalid "NaN")
        sys.stdout.write(result.to_json(orient="records", force_ascii=False))
    except Exception as e:
        sys.stdout.write(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
