from pydantic import Field

from app.types.base import ResponseModel


class HealthStatus(ResponseModel):
    """Liveness plus B2 reachability.

    The route answers HTTP 200 even when B2 is unreachable, so a caller must
    read `b2_connected` rather than trusting the status code.
    """

    status: str = Field(description='"healthy" when B2 answered, else "degraded".')
    b2_connected: bool = Field(
        description="True when the bucket answered a cheap head request."
    )
