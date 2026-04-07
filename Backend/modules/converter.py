import os
import markdown
from pdf2docx import Converter
from docx2pdf import convert as doc_to_pdf
import img2pdf
from fpdf import FPDF
from docx import Document
from PIL import Image

def run_conversion(files, target_format, output_dir):
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Clear old temp files before starting new task
        for f in os.listdir(output_dir):
            os.remove(os.path.join(output_dir, f))

        results = []
        for file in files:
            filename = file.filename
            input_path = os.path.join(output_dir, filename)
            
            # Write uploaded file to disk temporarily
            with open(input_path, "wb") as f:
                f.write(file.file.read())

            ext = os.path.splitext(filename)[1].lower()
            output_filename = f"converted_{os.path.splitext(filename)[0]}.{target_format}"
            output_path = os.path.join(output_dir, output_filename)

            # --- CONVERSION ENGINE ---
            if ext == '.pdf' and target_format == 'docx':
                cv = Converter(input_path); cv.convert(output_path); cv.close()
            
            elif ext == '.docx' and target_format == 'pdf':
                doc_to_pdf(input_path, output_path)

            elif ext in ['.jpg', '.png', '.jpeg'] and target_format == 'pdf':
                with open(output_path, "wb") as f:
                    f.write(img2pdf.convert(input_path))
            
            elif ext in ['.jpg', '.png', '.jpeg'] and target_format in ['jpg', 'png', 'webp']:
                img = Image.open(input_path).convert("RGB")
                img.save(output_path, target_format.upper())

            elif ext == '.txt' and target_format == 'pdf':
                pdf = FPDF(); pdf.add_page(); pdf.set_font("Arial", size=12)
                with open(input_path, "r") as txt_file:
                    for line in txt_file:
                        pdf.cell(200, 10, txt=line.encode('latin-1', 'replace').decode('latin-1'), ln=1)
                pdf.output(output_path)

            elif ext == '.txt' and target_format == 'docx':
                doc = Document()
                with open(input_path, "r") as txt_file:
                    doc.add_paragraph(txt_file.read())
                doc.save(output_path)

            elif ext == '.md' and target_format == 'pdf':
                with open(input_path, "r") as md_file:
                    html_text = markdown.markdown(md_file.read())
                pdf = FPDF(); pdf.add_page(); pdf.set_font("Arial", size=10)
                pdf.multi_cell(0, 10, txt=html_text.encode('latin-1', 'replace').decode('latin-1'))
                pdf.output(output_path)

            results.append(output_filename)
            if os.path.exists(input_path): os.remove(input_path) 

        return {"type": "success", "message": f"Successfully converted {len(files)} files."}
    except Exception as e:
        return {"type": "error", "message": str(e)}