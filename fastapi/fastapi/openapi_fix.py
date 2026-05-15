"""Fix OpenAPI schema missing server/contact — issue 801.
"""
def augment_openapi(app, schema: dict):
    schema.setdefault("servers", [{"url": "/"}])
    schema.setdefault("info", {}).setdefault("contact", {"name": "API Support", "url": "/support"})
    return schema
