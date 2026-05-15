"""Custom validation error handler — issue 757.
"""
from typing import Any
from fastapi.responses import JSONResponse

def fix_validation_error(exc) -> JSONResponse:
    return JSONResponse(status_code=422, content={
        "detail": [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    })


def install(app) -> None:
    from fastapi.exceptions import RequestValidationError
    app.add_exception_handler(RequestValidationError, fix_validation_error)
