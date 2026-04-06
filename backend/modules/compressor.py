import os
import io
import base64
from PIL import Image

<<<<<<< HEAD

=======
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
def get_preview(file_content, quality):
    """Generates a base64 string for real-time preview in the UI."""
    img = Image.open(io.BytesIO(file_content))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
<<<<<<< HEAD

    preview_io = io.BytesIO()
    img.save(preview_io, format="JPEG", quality=int(quality), optimize=True)

    encoded_img = base64.b64encode(preview_io.getvalue()).decode("utf-8")
    preview_size = preview_io.tell()

    return {
        "preview_url": f"data:image/jpeg;base64,{encoded_img}",
        "estimated_size": preview_size,
    }

=======
    
    preview_io = io.BytesIO()
    img.save(preview_io, format="JPEG", quality=int(quality), optimize=True)
    
    encoded_img = base64.b64encode(preview_io.getvalue()).decode('utf-8')
    return f"data:image/jpeg;base64,{encoded_img}"
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4

def run_compression(files, quality, temp_dir):
    """Saves individual compressed files to a temp folder."""
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
<<<<<<< HEAD

=======
    
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
    # Clear old temp files first
    for f in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, f))

    compressed_files = []
    for file in files:
        img = Image.open(file.file)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
<<<<<<< HEAD

=======
        
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
        filename = f"compressed_{os.path.splitext(file.filename)[0]}.jpg"
        save_path = os.path.join(temp_dir, filename)
        img.save(save_path, format="JPEG", quality=int(quality), optimize=True)
        compressed_files.append(filename)

    return {
        "type": "success",
        "message": f"Successfully compressed {len(files)} images. Ready to save.",
<<<<<<< HEAD
        "count": len(files),
    }
=======
        "count": len(files)
    }
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
