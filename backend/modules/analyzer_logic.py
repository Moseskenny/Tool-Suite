import pandas as pd
from fpdf import FPDF
import matplotlib
matplotlib.use('Agg') # Prevents server crashes when generating UI charts
import matplotlib.pyplot as plt
from datetime import datetime
import os
import re
import io
import base64

class ExpenseAnalyzer:
    def __init__(self, csv_path, is_splitwise=False):
        self.currency = "" 
        self.df = self._huntsman_load(csv_path, is_splitwise)
        self.subs = []
        self.prediction = {}

    def _huntsman_load(self, path, is_splitwise):
        df = None

        # 1. THE UNIVERSAL READER: Try Excel first (catches disguised CSVs)
        try:
            df = pd.read_excel(path)
        except Exception:
            # 2. Fallback: Try multiple text encodings if it truly is a CSV
            encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin1', 'iso-8859-1']
            for enc in encodings:
                try:
                    df = pd.read_csv(path, sep=None, engine='python', encoding=enc, on_bad_lines='skip')
                    break
                except Exception:
                    continue

        if df is None or df.empty:
            raise ValueError("Critical Error: Could not read the file. Ensure it is a valid CSV or Excel document.")

        # 3. PRE-CLEANING: Strip garbage metadata 
        # (Banks love putting 5 blank rows at the top of their files)
        df = df.dropna(how='all') # Drop completely empty rows
        df = df.dropna(axis=1, how='all') # Drop completely empty columns
        
        # Lowercase all headers for easier matching
        df.columns = [str(c).strip().lower() for c in df.columns]

        # 4. EXTRACTION MAPPING
        mapping = {}
        targets = {
            'Date': ['date', 'timestamp', 'time', 'day', 'txn date'],
            'Desc': ['desc', 'payee', 'details', 'narrative', 'category', 'merchant', 'name', 'type', 'notes', 'particulars'],
            'Amt': ['amount', 'expense', 'debit', 'value', 'cost', 'total', 'price', 'paid', 'withdrawal']
        }
        
        for key, syns in targets.items():
            for col in df.columns:
                if any(s in col for s in syns):
                    mapping[col] = key 
                    break
        
        # 5. CURRENCY DETECTION
        symbols = ['$', '€', '£', '₹', '¥', '₽', '₩', 'A$', 'C$']
        for col_name in df.columns:
            for sym in symbols:
                if sym in col_name:
                    self.currency = sym
                    break
        
        df = df.rename(columns=mapping)
        
        # Safety Check
        missing_cols = [col for col in ['Desc', 'Amt'] if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Could not find columns for: {', '.join(missing_cols)}. Found headers: {list(df.columns)}")
        
        if not self.currency:
            raw_amounts = df['Amt'].astype(str)
            for sym in symbols:
                if raw_amounts.str.contains(re.escape(sym)).any():
                    self.currency = sym
                    break
        if not self.currency:
            self.currency = "₹" 

        # 6. DATA SANITIZATION
        # Scrub out commas and text from numbers
        df['Amt'] = pd.to_numeric(df['Amt'].astype(str).str.replace(r'[^\d.-]', '', regex=True), errors='coerce').fillna(0)
        
        if 'Desc' in df.columns:
            df['Desc'] = df['Desc'].fillna('Unknown').astype(str)
            df['Desc'] = df['Desc'].replace(r'^\s*$', 'Unknown', regex=True)
            
        if is_splitwise:
            share_col = [c for c in df.columns if 'share' in str(c).lower()]
            if share_col: 
                df['Amt'] = pd.to_numeric(df[share_col[0]].astype(str).str.replace(r'[^\d.-]', '', regex=True)).fillna(0)
        
        # 7. EXTRACT ONLY WHAT MATTERS
        available_cols = [c for c in ['Date', 'Desc', 'Amt'] if c in df.columns]
        return df[available_cols]

        # --- CLEAN DATA ---
        df['Amt'] = pd.to_numeric(df['Amt'].astype(str).str.replace(r'[^\d.-]', '', regex=True), errors='coerce').fillna(0)
        
        if 'Desc' in df.columns:
            df['Desc'] = df['Desc'].fillna('Unknown').astype(str)
            df['Desc'] = df['Desc'].replace(r'^\s*$', 'Unknown', regex=True)
            
        if is_splitwise:
            share_col = [c for c in df.columns if 'share' in str(c).lower()]
            if share_col: 
                df['Amt'] = pd.to_numeric(df[share_col[0]].astype(str).str.replace(r'[^\d.-]', '', regex=True)).fillna(0)
        
        available_cols = [c for c in ['Date', 'Desc', 'Amt'] if c in df.columns]
        return df[available_cols]

    def run_intelligence(self, purchase_price):
        sub_groups = self.df.groupby(['Desc', 'Amt']).size().reset_index(name='count')
        self.subs = sub_groups[sub_groups['count'] >= 2].to_dict('records')

        total_expense = self.df['Amt'].sum()
        total_days = 30 
        if 'Date' in self.df.columns:
            try:
                dates = pd.to_datetime(self.df['Date'], errors='coerce').dropna()
                if not dates.empty:
                    calc_days = (dates.max() - dates.min()).days
                    total_days = calc_days if calc_days > 0 else 30
            except:
                pass

        burn_rate = total_expense / total_days
        projected = (burn_rate * 30) + sum(s['Amt'] for s in self.subs)
        
        # --- GENERATE UI CHART ---
        plt.figure(figsize=(6, 4), facecolor='none')
        top_expenses = self.df[self.df['Amt'] > 0].groupby('Desc')['Amt'].sum().nlargest(5)
        
        chart_base64 = ""
        if not top_expenses.empty:
            plt.pie(top_expenses, labels=top_expenses.index, autopct='%1.1f%%', startangle=140, colors=plt.cm.Set3.colors, textprops={'color':"w"})
            plt.title('Top 5 Spending Areas', color='white')
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png', transparent=True, bbox_inches='tight')
            buf.seek(0)
            chart_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        status = "Affordable" if float(purchase_price) < (projected * 0.5) else "Risky"
        self.prediction = {
            "burn_rate": round(burn_rate, 2), 
            "projected": round(projected, 2), 
            "status": status,
            "currency": self.currency,
            "chart_img": f"data:image/png;base64,{chart_base64}" if chart_base64 else None,
            "note": "Assumed 30-day period (No date column found)" if 'Date' not in self.df.columns else ""
        }
        return self.prediction

    def generate_pdf(self, output_path):
        pdf = FPDF()
        pdf.add_page()
        
        # --- PDF Font Safety Check ---
        pdf_currency = self.currency
        safe_symbols = {'₹': 'Rs. ', '€': 'EUR ', '£': 'GBP ', '¥': 'JPY ', '₽': 'RUB '}
        if pdf_currency in safe_symbols:
            pdf_currency = safe_symbols[pdf_currency]

        # --- 1. GENERATE A SPECIFIC CHART FOR THE PDF ---
        # We use black text here since the PDF has a white background
        plt.figure(figsize=(7, 4))
        top_expenses = self.df[self.df['Amt'] > 0].groupby('Desc')['Amt'].sum().nlargest(5)
        
        chart_path = os.path.join(os.path.dirname(output_path), "pdf_chart_temp.png")
        if not top_expenses.empty:
            plt.pie(top_expenses, labels=top_expenses.index, autopct='%1.1f%%', startangle=140, colors=plt.cm.Set3.colors, textprops={'color':"black"})
            plt.title('Top 5 Spending Areas', color='black', pad=20)
            plt.savefig(chart_path, bbox_inches='tight', facecolor='white')
        plt.close()

        # --- 2. BUILD THE REPORT ---
        pdf.set_font("Arial", 'B', 22)
        pdf.cell(0, 10, "Comprehensive Expense Report", ln=True, align='C')
        pdf.ln(8)
        
        # Section 1: Executive Summary
        pdf.set_font("Arial", 'B', 14)
        pdf.set_fill_color(240, 240, 240)
        pdf.cell(0, 10, " 1. Executive Summary", ln=True, fill=True)
        pdf.ln(4)
        
        pdf.set_font("Arial", '', 12)
        pdf.cell(0, 8, f"Daily Burn Rate: {pdf_currency}{self.prediction.get('burn_rate')}", ln=True)
        pdf.cell(0, 8, f"Projected 30-Day Spend: {pdf_currency}{self.prediction.get('projected')}", ln=True)
        pdf.cell(0, 8, f"Total Transactions Analyzed: {len(self.df)}", ln=True)
        pdf.ln(8)

        # Inject the Chart Image!
        if os.path.exists(chart_path):
            pdf.image(chart_path, x=25, w=160)
            os.remove(chart_path) # Clean up the temp image
            pdf.ln(8)

        # Section 2: Key Insights & Warnings
        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, " 2. Key Insights & Warnings", ln=True, fill=True)
        pdf.ln(4)
        pdf.set_font("Arial", '', 11)
        
        # Insight A: Largest Single Expense
        if not self.df.empty and self.df['Amt'].max() > 0:
            max_row = self.df.loc[self.df['Amt'].idxmax()]
            pdf.cell(0, 8, f"- Largest Single Transaction: {max_row['Desc']} ({pdf_currency}{max_row['Amt']})", ln=True)

        # Insight B: Dependency Percentage
        if not top_expenses.empty:
            top_cat_name = top_expenses.index[0]
            top_cat_amt = top_expenses.iloc[0]
            total_spend = self.df['Amt'].sum()
            if total_spend > 0:
                pct = (top_cat_amt / total_spend) * 100
                pdf.cell(0, 8, f"- Heavy Dependency: {pct:.1f}% of your total spending goes to '{top_cat_name}'.", ln=True)

        # Insight C: Subscriptions & Repeat Purchases
        pdf.ln(4)
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(0, 8, "Detected Subscriptions & Repeat Purchases:", ln=True)
        pdf.set_font("Arial", '', 11)
        
        if not self.subs:
            pdf.cell(0, 8, "  No repeat purchases detected in this timeframe.", ln=True)
        else:
            for s in self.subs:
                pdf.cell(0, 8, f"  * {s['Desc']}: {pdf_currency}{s['Amt']} (Billed {s['count']} times)", ln=True)

        # Final Save
        pdf.output(output_path)