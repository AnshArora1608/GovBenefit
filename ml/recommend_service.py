
import sys
import json
import io
import contextlib
import pandas as pd


with contextlib.redirect_stdout(io.StringIO()):
    from recommend import recommend


def main():
    try:
        input_data = sys.stdin.read().strip()

        if not input_data:
            raise ValueError("No input received")

        data = json.loads(input_data)

        result = recommend(
            state=data.get("state", ""),
            gender=data.get("gender", "male"),
            social_cat=data.get("social_cat", "General"),
            minority=data.get("minority", False),
            disability=data.get("disability", False),
            bpl=data.get("bpl", False),
            age=int(data.get("age", 30)),
            income=float(data.get("income", 200000)),
            need=data.get(
                "need",
                "loan subsidy to start small business"
            ),
            top=int(data.get("top", 10)),
            entrepreneur_only=data.get(
                "entrepreneur_only",
                True
            )
        )

        result = result.where(pd.notnull(result), None)

        print(
            json.dumps(
                result.to_dict(orient="records"),
                ensure_ascii=False
            )
        )

    except Exception as e:
        print(
            json.dumps({
                "error": str(e)
            })
        )
        sys.exit(1)


if __name__ == "__main__":
    main()

