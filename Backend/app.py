from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import shutil
import os
import sys
import re
import uvicorn
import tempfile
import threading

# Custom modules
from modules.compressor import get_preview, run_compression
from modules.fileorganizer import run_organizer
from modules.converter import run_conversion, analyze_files
from modules.analyzer_logic import ExpenseAnalyzer, MappingRequiredError
from modules.screen_recorder import run_screen_recorder
from modules.pdf_toolkit import run_pdf_toolkit

# 1. Initialize the App
app = FastAPI()

# 2. Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Setup ALL Directories (This is what was missing!)
BASE_DIR = os.path.join(tempfile.gettempdir(), "ToolSuite_Data")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
TEMP_COMPRESS_DIR = os.path.join(OUTPUT_DIR, "temp_compress")
TEMP_CONVERT_DIR = os.path.join(OUTPUT_DIR, "temp_convert")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
REPORT_DIR = os.path.join(BASE_DIR, "reports")

# Safely create all folders if they don't exist
for folder in [
    BASE_DIR,
    OUTPUT_DIR,
    TEMP_COMPRESS_DIR,
    TEMP_CONVERT_DIR,
    UPLOAD_DIR,
    REPORT_DIR,
]:
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)


class FolderRequest(BaseModel):
    path: str


class ExportRequest(BaseModel):
    destination: str


def _format_size(bytes_val):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"


# --- Global Conversion Progress ---
conversion_progress = {"percent": 0, "status": "idle", "message": ""}
_progress_lock = threading.Lock()


def _set_progress(percent, status=None, message=None):
    global conversion_progress
    with _progress_lock:
        conversion_progress["percent"] = percent
        if status:
            conversion_progress["status"] = status
        if message:
            conversion_progress["message"] = message


# --- COMPRESSOR, ORGANIZER & CONVERTER ROUTES ---


@app.get("/health")
async def health_check():
    return {"status": "ready"}


@app.get("/convert-progress")
async def get_convert_progress():
    with _progress_lock:
        return dict(conversion_progress)


@app.post("/process-convert")
def process_convert(
    files: list[UploadFile] = File(...), target_format: str = Form(...)
):
    _set_progress(0, "processing", "Starting conversion...")

    def progress_cb(pct):
        _set_progress(pct, "processing", f"Converting... {pct}%")

    result = run_conversion(files, target_format, TEMP_CONVERT_DIR, progress_callback=progress_cb)

    if result.get("status") == "success":
        _set_progress(100, "complete", "Conversion complete")
    else:
        _set_progress(0, "error", result.get("message", "Conversion failed"))

    return result


@app.post("/analyze-conversion")
async def analyze_conversion(files: list[UploadFile] = File(...)):
    return analyze_files(files, TEMP_CONVERT_DIR)


@app.post("/export-converted")
async def export_converted(request: ExportRequest):
    try:
        if not os.path.exists(TEMP_CONVERT_DIR):
            return {"status": "error", "message": "Temp directory missing. Please convert again."}

        all_items = os.listdir(TEMP_CONVERT_DIR)
        filenames = [f for f in all_items if os.path.isfile(os.path.join(TEMP_CONVERT_DIR, f))]

        print(f"[Export] Destination: {request.destination}")
        print(f"[Export] Files found in temp: {filenames}")

        if not filenames:
            return {"status": "error", "message": "No converted files found. Please convert again."}

        saved = 0
        errors = []
        saved_files = []
        for filename in filenames:
            src = os.path.join(TEMP_CONVERT_DIR, filename)
            src_size = os.path.getsize(src)
            print(f"[Export] Processing: {filename} ({src_size} bytes)")
            if src_size == 0:
                print(f"[Export] Skipping empty file: {filename}")
                continue
            clean_name = re.sub(r'^converted_', '', filename)
            dest = os.path.join(request.destination, clean_name)
            if os.path.exists(dest):
                base, ext = os.path.splitext(clean_name)
                counter = 1
                while os.path.exists(os.path.join(request.destination, f"{base}_{counter}{ext}")):
                    counter += 1
                dest = os.path.join(request.destination, f"{base}_{counter}{ext}")
            try:
                shutil.copy2(src, dest)
                saved += 1
                saved_files.append(os.path.basename(dest))
                print(f"[Export] Copied to: {dest}")
            except Exception as copy_err:
                errors.append(f"{clean_name}: {str(copy_err)}")
                print(f"[Export] FAILED: {clean_name} - {copy_err}")

        print(f"[Export] Result: {saved} file(s) saved = {saved_files}")

        if saved == 0:
            return {"status": "error", "message": "Could not save any files. The converted file may be empty."}

        msg = f"{saved} file(s) saved"
        if errors:
            msg += f" ({len(errors)} skipped: {'; '.join(errors)})"
        return {"status": "success", "message": msg, "files": saved_files}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/organize-local")
async def organize_local(request: FolderRequest):
    return run_organizer(request.path)


@app.post("/compress-preview")
async def preview(file: UploadFile = File(...), quality: int = Form(...)):
    contents = await file.read()
    result = get_preview(contents, quality)
    return result


@app.post("/process-compress")
async def process_compress(
    files: list[UploadFile] = File(...), quality: int = Form(...)
):
    return run_compression(files, quality, TEMP_COMPRESS_DIR)


@app.post("/export-images")
async def export_images(request: ExportRequest):
    try:
        if not os.listdir(TEMP_COMPRESS_DIR):
            return {"error": "No compressed files found in temp."}

        for filename in os.listdir(TEMP_COMPRESS_DIR):
            src = os.path.join(TEMP_COMPRESS_DIR, filename)
            dest = os.path.join(request.destination, filename)
            shutil.copy2(src, dest)

        return {"message": f"Successfully saved files to {request.destination}"}
    except Exception as e:
        return {"error": f"Export failed: {str(e)}"}


@app.get("/download/{filename}")
async def download_file(filename: str):
    return FileResponse(os.path.join(OUTPUT_DIR, filename))


@app.get("/download-report/{filename}")
async def download_report(filename: str):
    return FileResponse(os.path.join(REPORT_DIR, filename))


# --- EXPENSE ANALYZER ROUTES ---


@app.post("/analyze")
async def analyze_endpoint(
    file: UploadFile = File(...),
    price: float = Form(0.0),
    is_splitwise: bool = Form(False),
):
    # 1. Save File to the UPLOAD_DIR
    temp_csv = os.path.join(UPLOAD_DIR, file.filename)
    with open(temp_csv, "wb") as f:
        f.write(await file.read())

    # 2. Process Data
    try:
        analyzer = ExpenseAnalyzer(temp_csv, is_splitwise=is_splitwise)
    except MappingRequiredError as e:
        return {
            "requires_mapping": True,
            "columns": e.columns,
            "filename": file.filename,
        }
    except ValueError as e:
        return {"error": str(e)}

    prediction = analyzer.run_intelligence(price)

    # 3. Create PDF
    report_name = f"Report_{file.filename.split('.')[0]}.pdf"
    report_path = os.path.join(REPORT_DIR, report_name)
    analyzer.generate_pdf(report_path)

    return {
        "prediction": prediction,
        "report_name": report_name,  # Return filename, not absolute path
    }


@app.post("/analyze-manual")
async def analyze_manual_endpoint(
    file: UploadFile = File(...),
    price: float = Form(0.0),
    is_splitwise: bool = Form(False),
    date_col: str = Form(""),
    desc_col: str = Form(""),
    amt_col: str = Form(""),
):
    temp_csv = os.path.join(UPLOAD_DIR, file.filename)
    with open(temp_csv, "wb") as f:
        f.write(await file.read())

    mapping = {}
    if date_col: mapping["date"] = date_col
    if desc_col: mapping["desc"] = desc_col
    if amt_col: mapping["amt"] = amt_col

    try:
        analyzer = ExpenseAnalyzer(temp_csv, is_splitwise=is_splitwise, explicit_mapping=mapping)
    except ValueError as e:
        return {"error": str(e)}

    prediction = analyzer.run_intelligence(price)

    report_name = f"Report_{file.filename.split('.')[0]}.pdf"
    report_path = os.path.join(REPORT_DIR, report_name)
    analyzer.generate_pdf(report_path)

    return {
        "prediction": prediction,
        "report_name": report_name,
    }


# --- NEW FEATURES ---


@app.post("/screen-recorder/start")
async def start_screen_recorder():
    RECORDING_DIR = os.path.join(OUTPUT_DIR, "recordings")
    if not os.path.exists(RECORDING_DIR):
        os.makedirs(RECORDING_DIR, exist_ok=True)
    return run_screen_recorder("start", temp_dir=RECORDING_DIR)


@app.post("/screen-recorder/stop")
async def stop_screen_recorder():
    return run_screen_recorder("stop")


@app.get("/screen-recorder/status")
async def get_screen_recorder_status():
    return run_screen_recorder("status")


@app.post("/pdf-toolkit/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    return run_pdf_toolkit("merge", files=files)


@app.post("/pdf-toolkit/split")
async def split_pdf_endpoint(
    file: UploadFile = File(...), split_at_page: int = Form(None)
):
    return run_pdf_toolkit("split", files=[file], split_at_page=split_at_page)


@app.post("/pdf-toolkit/analyze")
async def analyze_pdf_endpoint(file: UploadFile = File(...)):
    return run_pdf_toolkit("analyze", files=[file])


@app.post("/pdf-toolkit/save-merged")
async def save_merged(request: ExportRequest):
    try:
        temp_dir = os.path.join(tempfile.gettempdir(), "ToolSuite_Data", "temp_pdf")
        if not os.path.exists(temp_dir):
            return {"error": "No merged PDF found."}

        files = [
            f
            for f in os.listdir(temp_dir)
            if f.startswith("merged_") and f.endswith(".pdf")
        ]
        if not files:
            return {"error": "No merged PDF found."}

        src = os.path.join(temp_dir, files[0])
        shutil.copy2(src, request.destination)

        return {"message": f"PDF saved to {request.destination}"}
    except Exception as e:
        return {"error": f"Save failed: {str(e)}"}


@app.post("/pdf-toolkit/save-split")
async def save_split(request: ExportRequest):
    try:
        temp_dir = os.path.join(tempfile.gettempdir(), "ToolSuite_Data", "temp_pdf")
        if not os.path.exists(temp_dir):
            return {"error": "No split PDFs found."}

        for filename in os.listdir(temp_dir):
            if filename.startswith("split_") and filename.endswith(".pdf"):
                src = os.path.join(temp_dir, filename)
                dest = os.path.join(request.destination, filename)
                shutil.copy2(src, dest)

        return {"message": f"PDFs saved to {request.destination}"}
    except Exception as e:
        return {"error": f"Save failed: {str(e)}"}


@app.post("/export-recordings")
async def export_recordings(request: ExportRequest):
    try:
        RECORDING_DIR = os.path.join(OUTPUT_DIR, "recordings")
        if not os.path.exists(RECORDING_DIR):
            return {"error": "No recordings found."}

        files = [f for f in os.listdir(RECORDING_DIR) if f.endswith(".mp4")]
        if not files:
            return {"error": "No recordings found."}

        files.sort(key=lambda x: os.path.getmtime(os.path.join(RECORDING_DIR, x)))
        latest = files[-1]

        src = os.path.join(RECORDING_DIR, latest)
        dest = os.path.join(request.destination, latest)
        shutil.copy2(src, dest)

        for old_file in files[:-1]:
            old_path = os.path.join(RECORDING_DIR, old_file)
            if os.path.exists(old_path):
                os.remove(old_path)

        return {"message": f"Recording saved to {request.destination}"}
    except Exception as e:
        return {"error": f"Export failed: {str(e)}"}


@app.post("/export-pdfs")
async def export_pdfs(request: ExportRequest):
    try:
        PDF_DIR = os.path.join(OUTPUT_DIR, "temp_pdf")
        if not os.path.exists(PDF_DIR):
            return {"error": "No PDF files found."}

        for filename in os.listdir(PDF_DIR):
            if filename.endswith(".pdf"):
                src = os.path.join(PDF_DIR, filename)
                dest = os.path.join(request.destination, filename)
                shutil.copy2(src, dest)

        return {"message": f"PDFs saved to {request.destination}"}
    except Exception as e:
        return {"error": f"Export failed: {str(e)}"}


if __name__ == "__main__":
    # Robust terminal mock to prevent 'isatty' errors in windowed mode
    class SafeStream:
        def __init__(self, s):
            self.s = s

        def write(self, d):
            if self.s:
                self.s.write(d)

        def isatty(self):
            return False

        def flush(self):
            pass

    if sys.stdout is None or not hasattr(sys.stdout, "isatty"):
        sys.stdout = SafeStream(sys.stdout)
    if sys.stderr is None or not hasattr(sys.stderr, "isatty"):
        sys.stderr = SafeStream(sys.stderr)

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")