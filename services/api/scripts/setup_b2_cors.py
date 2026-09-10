"""Add a web origin to the B2 bucket's CORS so the browser can upload directly.

The direct-to-B2 upload flow has the browser PUT bytes straight to the bucket,
so the bucket must allow your web origin (method PUT + the `content-type`
header). Local dev origins are typically already allowed; run this once per
deployed origin (your Vercel/production URL).

Usage:
    # dry run (default): print current + proposed CORS, write nothing
    python services/api/scripts/setup_b2_cors.py --origin https://your-app.vercel.app

    # actually write it
    python services/api/scripts/setup_b2_cors.py --origin https://your-app.vercel.app --apply

Reads B2 credentials from the repo-root .env exactly like the app. It MERGES:
existing CORS rules are preserved and one rule (ID `vcsk-direct-upload`) is
added/updated for the given origins. Never prints credentials.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# Import the app's settings loader (repo-root .env) without printing secrets.
API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))
from app.config import settings  # noqa: E402

RULE_ID = "vcsk-direct-upload"


def out(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def err(message: str) -> None:
    sys.stderr.write(f"{message}\n")


def _client():
    # Standalone client (not app.repo.get_s3_client) on purpose: bucket-level
    # CORS calls sign more reliably with an explicit region derived from the
    # endpoint, whereas the app client leaves region unset for object ops.
    host = settings.b2_endpoint.split("://", 1)[-1]
    region = host.split(".")[1] if host.startswith("s3.") else "us-east-005"
    return boto3.client(
        "s3",
        endpoint_url=settings.b2_endpoint,
        aws_access_key_id=settings.b2_key_id,
        aws_secret_access_key=settings.b2_application_key,
        region_name=region,
        config=Config(signature_version="s3v4", user_agent_extra="b2ai-oss-start"),
    )


def _current_rules(client) -> list[dict]:
    try:
        return client.get_bucket_cors(Bucket=settings.b2_bucket_name).get(
            "CORSRules", []
        )
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "NoSuchCORSConfiguration":
            return []
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--origin",
        action="append",
        required=True,
        metavar="URL",
        help="Web origin to allow, e.g. https://your-app.vercel.app (repeatable)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the change. Without it, this is a dry run.",
    )
    args = parser.parse_args()

    for origin in args.origin:
        if "://" not in origin or origin.endswith("/"):
            parser.error(f"origin must be scheme://host with no trailing slash: {origin!r}")

    if not settings.b2_bucket_name:
        err("B2_BUCKET_NAME is not set — configure .env first.")
        return 2

    client = _client()
    current = _current_rules(client)
    our_rule = {
        "ID": RULE_ID,
        "AllowedOrigins": args.origin,
        "AllowedMethods": ["GET", "PUT", "HEAD"],
        "AllowedHeaders": ["content-type", "authorization"],
        "ExposeHeaders": ["etag"],
        "MaxAgeSeconds": 3600,
    }
    # Preserve every other app's rules; replace only our own by ID.
    merged = [r for r in current if r.get("ID") != RULE_ID] + [our_rule]

    out(f"Bucket: {settings.b2_bucket_name}")
    out(f"Current CORS rules: {len(current)}")
    out("Proposed rule (merged in):")
    out(json.dumps(our_rule, indent=2))

    if not args.apply:
        out("\nDry run — re-run with --apply to write this change.")
        return 0

    client.put_bucket_cors(
        Bucket=settings.b2_bucket_name,
        CORSConfiguration={"CORSRules": merged},
    )
    out(f"\nApplied. Bucket now has {len(merged)} CORS rule(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
