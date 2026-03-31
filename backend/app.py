from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import shutil
import os

# Custom modules
from modules.compressor import get_preview, run_compression
from modules.fileoragnizer import run_organizer
from modules.converter import run_conversion
from modules.analyzer_logic import ExpenseAnalyzer

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
BASE_DIR = os.path.dirname(__file__)
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
TEMP_COMPRESS_DIR = os.path.join(OUTPUT_DIR, "temp_compress")
TEMP_CONVERT_DIR = os.path.join(OUTPUT_DIR, "temp_convert")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
REPORT_DIR = os.path.join(BASE_DIR, "reports")

# Safely create all folders if they don't exist
for folder in [OUTPUT_DIR, TEMP_COMPRESS_DIR, TEMP_CONVERT_DIR, UPLOAD_DIR, REPORT_DIR]:
    if not os.path.exists(folder):
        os.makedirs(folder)

class FolderRequest(BaseModel):
    path: str

class ExportRequest(BaseModel):
    destination: str

# --- COMPRESSOR, ORGANIZER & CONVERTER ROUTES ---

@app.post("/process-convert")
async def process_convert(files: list[UploadFile] = File(...), target_format: str = Form(...)):
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
    return {"preview_url": get_preview(contents, quality)}

@app.post("/process-compress")
async def process_compress(files: list[UploadFile] = File(...), quality: int = Form(...)):
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
    is_splitwise: bool = Form(False)
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
        "pdf_url": report_path
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)