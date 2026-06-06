"""Custom validation error handler for RequestValidationError (issue 757).
"""
from typing import Any
from fastapi.responses import JSONResponse

def fix_validation_error(exc) -> JSONResponse:
    details = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]}
               for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": details})

def install(app) -> None:
    app.add_exception_handler(type(exc), fix_validation_error)
