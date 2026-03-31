import pandas as pd
import io
import re
import os

# Create an outputs directory if it doesn't exist
OUTPUT_DIR = "outputs"
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def universal_expense_parser(contents):
    try:
        df = pd.read_csv(
            io.BytesIO(contents), 
            sep=None, 
            engine='python', 
            encoding='latin1', 
            on_bad_lines='skip'
        )

        df.columns = [str(col).lower().strip() for col in df.columns]

        # Fuzzy Matching
        cat_keywords = ['category', 'type', 'label', 'tag', 'group', 'description', 'payee']
        category_col = next((col for col in df.columns if any(k in col for k in cat_keywords)), None)

        val_keywords = ['expense', 'amount', 'total', 'cost', 'price', 'value', 'income']
        value_col = next((col for col in df.columns if any(k == col for k in ['expense', 'amount'])), None)
        if not value_col:
            value_col = next((col for col in df.columns if any(k in col for k in val_keywords)), None)

        if not category_col or not value_col:
            return {"type": "error", "message": f"Could not identify columns. Found: {list(df.columns)}"}

        # Cleaning and Processing
        df[value_col] = df[value_col].astype(str).str.replace(r'[^\d.]', '', regex=True)
        df[value_col] = pd.to_numeric(df[value_col], errors='coerce').fillna(0)
        summary = df.groupby(category_col)[value_col].sum().reset_index()
        summary.columns = ['category', 'amount']
        
        # --- NEW: Save the file to the outputs folder ---
        file_name = "expense_summary.csv"
        file_path = os.path.join(OUTPUT_DIR, file_name)
        summary.to_csv(file_path, index=False)

        return {
            "type": "table",
            "data": summary.to_dict(orient="records"),
            "download_url": f"http://127.0.0.1:8000/download/{file_name}"
        }

    except Exception as e:
        return {"type": "error", "message": f"Parser Error: {str(e)}"}