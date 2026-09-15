from pydantic import BaseModel, ConfigDict


class ResponseModel(BaseModel):
    """Base for models this API only ever *returns*.

    `json_schema_serialization_defaults_required` puts a field that has a
    default into the schema's `required` list. Pydantic serializes every field
    of a model, so a response body really does carry `url` even though `url`
    defaults to `None` — and the exported contract should say so.

    This matters because `packages/shared/src/generated/api-types.ts` is
    generated from that contract: without this config the generator would type
    such fields as optional (`url?: string | null`) and every consumer would
    have to narrow away an `undefined` that can never arrive.

    Request models deliberately do NOT inherit from this: for them a default
    really does mean "the client may omit it".
    """

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
