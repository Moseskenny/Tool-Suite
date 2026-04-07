from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import shutil
import os
import sys
import uvicorn
import tempfile

# Custom modules
from modules.compressor import get_preview, run_compression
from modules.fileoragnizer import run_organizer
from modules.converter import run_conversion
from modules.analyzer_logic import ExpenseAnalyzer
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


# --- COMPRESSOR, ORGANIZER & CONVERTER ROUTES ---


@app.get("/health")
async def health_check():
    return {"status": "ready"}


@app.post("/process-convert")
async def process_convert(
    files: list[UploadFile] = File(...), target_format: str = Form(...)
):
    return run_conversion(files, target_format, TEMP_CONVERT_DIR)


@app.post("/export-converted")
async def export_converted(request: ExportRequest):
    try:
        for filename in os.listdir(TEMP_CONVERT_DIR):
            src = os.path.join(TEMP_CONVERT_DIR, filename)
            dest = os.path.join(request.destination, filename)
            shutil.copy2(src, dest)
        return {"message": f"Files saved to {request.destination}"}
    except Exception as e:
        return {"error": str(e)}


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
    analyzer = ExpenseAnalyzer(temp_csv, is_splitwise=is_splitwise)
    prediction = analyzer.run_intelligence(price)

    # 3. Create PDF
    report_name = f"Report_{file.filename.split('.')[0]}.pdf"
    report_path = os.path.join(REPORT_DIR, report_name)
    analyzer.generate_pdf(report_path)

    return {
        "prediction": prediction,
        "report_name": report_name,  # Return filename, not absolute path
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
