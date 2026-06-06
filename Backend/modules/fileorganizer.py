import os
import shutil

FILE_TYPES = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
    'Videos': ['.mp4', '.avi', '.mov', '.wmv', '.mkv'],
    'Audio': ['.mp3', '.wav', '.aac', '.ogg'],
    'Documents': ['.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx'],
    'Others': []
}


def move_file(src, dest):
    base, ext = os.path.splitext(dest)
    counter = 1
    while os.path.exists(dest):
        dest = f"{base}_{counter}{ext}"
        counter += 1
    shutil.move(src, dest)


def run_organizer(folder_path):
    try:
        if not os.path.exists(folder_path):
            return {"status": "error", "message": "Folder path does not exist."}

        for category in FILE_TYPES.keys():
            os.makedirs(os.path.join(folder_path, category), exist_ok=True)

        moved_count = 0
        for filename in os.listdir(folder_path):
            full_path = os.path.join(folder_path, filename)
            if os.path.isfile(full_path):
                ext = os.path.splitext(filename)[1].lower()
                moved = False
                for category, extensions in FILE_TYPES.items():
                    if ext in extensions:
                        move_file(full_path, os.path.join(folder_path, category, filename))
                        moved = True
                        moved_count += 1
                        break
                if not moved:
                    move_file(full_path, os.path.join(folder_path, 'Others', filename))
                    moved_count += 1

        return {
            "status": "success",
            "message": f"Organized {moved_count} files successfully in your local folder!"
        }
    except Exception as e:
        return {"status": "error", "message": f"An error occurred: {str(e)}"}
