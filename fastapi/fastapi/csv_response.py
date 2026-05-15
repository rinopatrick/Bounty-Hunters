"""StreamingCSVResponse for large dataset exports — issue 799.
"""
import csv, io
from starlette.responses import StreamingResponse

def StreamingCSVResponse(rows: list[dict], filename="export.csv"):
    def gen():
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=rows[0].keys() if rows else [])
        w.writeheader()
        for row in rows:
            w.writerow(row); yield buf.getvalue(); buf.seek(0); buf.truncate(0)
    return StreamingResponse(gen(), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})
