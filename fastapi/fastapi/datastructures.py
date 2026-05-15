"""UploadFile: max_size + content_type validation (issue 761)."""
import mimetypes
from typing import List, Optional, Sequence
from starlette.datastructures import UploadFile as SFUpload
from fastapi import HTTPException

class ValidationResult:
    valid: bool
    file_size: Optional[int] = None
    content_type: Optional[str] = None
    def __init__(self, *, valid: bool, file_size=None, content_type=None):
        self.valid = valid
        self.file_size = file_size
        self.content_type = content_type


class UploadFile(SFUpload):
    already_read = 0

    def __init__(self, file, *, filename=None, content_type=None, headers=None,
                 max_size=None, allowed_content_types=None):
        super().__init__(file=file, filename=filename, content_type=content_type,
                         headers=headers)
        self.max_size = max_size
        self.allowed_content_types = allowed_content_types

    async def validate(self) -> ValidationResult:
        self.file.seek(0, 2)  # seek end
        sz = self.file.tell();  self.file.seek(0)
        ct = self.content_type or mimetypes.guess_type(self.filename or "")[0] or "application/octet-stream"
        ok = True
        if self.max_size and sz > self.max_size:
            ok = False
            raise HTTPException(status_code=413, detail=f"File exceeds {self.max_size} bytes")
        if self.allowed_content_types and ct not in self.allowed_content_types:
            ok = False
            raise HTTPException(status_code=415, detail=f"Content type {ct!r} not allowed")
        return ValidationResult(valid=ok, file_size=sz, content_type=ct)
