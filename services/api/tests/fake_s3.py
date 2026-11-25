"""A tiny in-memory S3 client for repo-boundary tests (no network, no boto3)."""

from io import BytesIO

from botocore.exceptions import ClientError


class FakeS3:
    def __init__(self, objects: dict[str, bytes] | None = None, page_size: int = 1000):
        self.objects: dict[str, bytes] = dict(objects or {})
        self.page_size = page_size
        self.put_calls: list[dict] = []

    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.put_calls.append({"Key": Key, "ContentType": ContentType})
        self.objects[Key] = Body if isinstance(Body, bytes) else Body.read()

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return {"Body": BytesIO(self.objects[Key])}

    def list_objects_v2(self, **kwargs):
        prefix = kwargs.get("Prefix", "")
        delimiter = kwargs.get("Delimiter")
        start = int(kwargs.get("ContinuationToken", 0))
        entries: list[tuple[str, str]] = []
        seen: set[str] = set()
        for key in sorted(self.objects):
            if not key.startswith(prefix):
                continue
            rest = key[len(prefix):]
            if delimiter and delimiter in rest:
                common = prefix + rest.split(delimiter, 1)[0] + delimiter
                if common not in seen:
                    seen.add(common)
                    entries.append(("prefix", common))
            else:
                entries.append(("key", key))
        page = entries[start : start + self.page_size]
        truncated = start + self.page_size < len(entries)
        response: dict = {
            "CommonPrefixes": [{"Prefix": v} for kind, v in page if kind == "prefix"],
            "Contents": [{"Key": v} for kind, v in page if kind == "key"],
            "IsTruncated": truncated,
        }
        if truncated:
            response["NextContinuationToken"] = str(start + self.page_size)
        return response
