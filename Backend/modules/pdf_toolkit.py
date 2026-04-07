import os
import tempfile
import time
from pypdf import PdfReader, PdfWriter


def analyze_pdf(file):
    try:
        temp_dir = os.path.join(tempfile.gettempdir(), "ToolSuite_Data", "temp_pdf")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir, exist_ok=True)

        input_path = os.path.join(temp_dir, file.filename)
        with open(input_path, "wb") as f:
            f.write(file.file.read())

        reader = PdfReader(input_path)
        total_pages = len(reader.pages)

        return {
            "status": "success",
            "total_pages": total_pages,
            "filename": file.filename,
        }
    except Exception as e:
        return {"error": f"Analyze failed: {str(e)}"}


def merge_pdfs(files, output_filename=None):
    try:
        if not files or len(files) < 2:
            return {"error": "At least 2 PDF files required for merging"}

        temp_dir = os.path.join(tempfile.gettempdir(), "ToolSuite_Data", "temp_pdf")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir, exist_ok=True)

        if os.path.exists(temp_dir):
            for f in os.listdir(temp_dir):
                os.remove(os.path.join(temp_dir, f))

        writer = PdfWriter()

        for file in files:
            temp_path = os.path.join(temp_dir, file.filename)
            with open(temp_path, "wb") as f:
                f.write(file.file.read())
            writer.append(temp_path)

        if output_filename is None:
            base_name = os.path.splitext(files[0].filename)[0]
            output_filename = f"merged_{base_name}.pdf"

        output_path = os.path.join(temp_dir, output_filename)
        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return {
            "status": "success",
            "message": f"Successfully merged {len(files)} PDFs",
            "filename": output_filename,
            "output_path": output_path,
        }
    except Exception as e:
        return {"error": f"Merge failed: {str(e)}"}


def split_pdf(file, split_at_page=None, output_dir=None):
    try:
        temp_dir = os.path.join(tempfile.gettempdir(), "ToolSuite_Data", "temp_pdf")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir, exist_ok=True)

        if os.path.exists(temp_dir):
            for f in os.listdir(temp_dir):
                if f.startswith("split_"):
                    os.remove(os.path.join(temp_dir, f))

        input_path = os.path.join(temp_dir, file.filename)
        with open(input_path, "wb") as f:
            f.write(file.file.read())

        reader = PdfReader(input_path)
        total_pages = len(reader.pages)

        if split_at_page is None or split_at_page < 1:
            split_at_page = (total_pages + 1) // 2

        if split_at_page > total_pages:
            split_at_page = total_pages

        base_name = os.path.splitext(file.filename)[0]

        writer1 = PdfWriter()
        for i in range(split_at_page - 1):
            writer1.add_page(reader.pages[i])

        part1_filename = f"split_part1_{base_name}.pdf"
        part1_path = os.path.join(temp_dir, part1_filename)
        with open(part1_path, "wb") as output_file:
            writer1.write(output_file)

        writer2 = PdfWriter()
        for i in range(split_at_page - 1, total_pages):
            writer2.add_page(reader.pages[i])

        part2_filename = f"split_part2_{base_name}.pdf"
        part2_path = os.path.join(temp_dir, part2_filename)
        with open(part2_path, "wb") as output_file:
            writer2.write(output_file)

        return {
            "status": "success",
            "message": f"Split into 2 PDFs: pages 1-{split_at_page - 1} and {split_at_page}-{total_pages}",
            "total_pages": total_pages,
            "split_at": split_at_page,
            "files": [part1_filename, part2_filename],
        }
    except Exception as e:
        return {"error": f"Split failed: {str(e)}"}


def run_pdf_toolkit(action, files=None, output_filename=None, split_at_page=None):
    if action == "analyze":
        if not files or len(files) != 1:
            return {"error": "Exactly 1 PDF file required"}
        return analyze_pdf(files[0])
    elif action == "merge":
        if not files:
            return {"error": "No files provided"}
        return merge_pdfs(files, output_filename)
    elif action == "split":
        if not files or len(files) != 1:
            return {"error": "Exactly 1 PDF file required for splitting"}
        return split_pdf(files[0], split_at_page=split_at_page)
    else:
        return {"error": "Invalid action"}
