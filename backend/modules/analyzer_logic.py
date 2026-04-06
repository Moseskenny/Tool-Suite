import pandas as pd
from fpdf import FPDF
import matplotlib
<<<<<<< HEAD
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
=======
matplotlib.use('Agg') # Prevents server crashes when generating UI charts
import matplotlib.pyplot as plt
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
from datetime import datetime
import os
import re
import io
import base64
<<<<<<< HEAD
import warnings
=======
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4

class ExpenseAnalyzer:
    def __init__(self, csv_path, is_splitwise=False):
        self.currency = "" 
        self.df = self._huntsman_load(csv_path, is_splitwise)
<<<<<<< HEAD
        self.df = self._categorize_expenses(self.df)
        self.subs = []
        self.habits = []
        self.anomalies = []
        self.score = 100
        self.prediction = {}

    def _huntsman_load(self, path, is_splitwise):
        """The original, stable Universal Reader."""
        df = None

        # 1. Try Excel first
        try:
            df = pd.read_excel(path)
        except Exception:
            # 2. Fallback: Try multiple text encodings
=======
        self.subs = []
        self.prediction = {}

    def _huntsman_load(self, path, is_splitwise):
        df = None

        # 1. THE UNIVERSAL READER: Try Excel first (catches disguised CSVs)
        try:
            df = pd.read_excel(path)
        except Exception:
            # 2. Fallback: Try multiple text encodings if it truly is a CSV
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
            encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin1', 'iso-8859-1']
            for enc in encodings:
                try:
                    df = pd.read_csv(path, sep=None, engine='python', encoding=enc, on_bad_lines='skip')
                    break
                except Exception:
                    continue

        if df is None or df.empty:
<<<<<<< HEAD
            raise ValueError("Critical Error: Could not read the file.")

        # 3. Clean garbage metadata and lowercase headers
        df = df.dropna(how='all').dropna(axis=1, how='all')
        df.columns = [str(c).strip().lower() for c in df.columns]

        # 4. Extraction Mapping
=======
            raise ValueError("Critical Error: Could not read the file. Ensure it is a valid CSV or Excel document.")

        # 3. PRE-CLEANING: Strip garbage metadata 
        # (Banks love putting 5 blank rows at the top of their files)
        df = df.dropna(how='all') # Drop completely empty rows
        df = df.dropna(axis=1, how='all') # Drop completely empty columns
        
        # Lowercase all headers for easier matching
        df.columns = [str(c).strip().lower() for c in df.columns]

        # 4. EXTRACTION MAPPING
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
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
        
<<<<<<< HEAD
        # 5. Currency Detection
        symbols = ['$', '€', '£', '₹', '¥', '₽', '₩', 'A$', 'C$', 'Rs']
=======
        # 5. CURRENCY DETECTION
        symbols = ['$', '€', '£', '₹', '¥', '₽', '₩', 'A$', 'C$']
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
        for col_name in df.columns:
            for sym in symbols:
                if sym in col_name:
                    self.currency = sym
                    break
        
        df = df.rename(columns=mapping)
        
<<<<<<< HEAD
        if not self.currency:
            raw_amounts = df['Amt'].astype(str)
            for sym in symbols:
                if raw_amounts.str.contains(re.escape(sym), case=False).any():
=======
        # Safety Check
        missing_cols = [col for col in ['Desc', 'Amt'] if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Could not find columns for: {', '.join(missing_cols)}. Found headers: {list(df.columns)}")
        
        if not self.currency:
            raw_amounts = df['Amt'].astype(str)
            for sym in symbols:
                if raw_amounts.str.contains(re.escape(sym)).any():
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
                    self.currency = sym
                    break
        if not self.currency:
            self.currency = "₹" 

<<<<<<< HEAD
        # 6. Data Sanitization
=======
        # 6. DATA SANITIZATION
        # Scrub out commas and text from numbers
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
        df['Amt'] = pd.to_numeric(df['Amt'].astype(str).str.replace(r'[^\d.-]', '', regex=True), errors='coerce').fillna(0)
        
        if 'Desc' in df.columns:
            df['Desc'] = df['Desc'].fillna('Unknown').astype(str)
            df['Desc'] = df['Desc'].replace(r'^\s*$', 'Unknown', regex=True)
            
        if is_splitwise:
            share_col = [c for c in df.columns if 'share' in str(c).lower()]
            if share_col: 
                df['Amt'] = pd.to_numeric(df[share_col[0]].astype(str).str.replace(r'[^\d.-]', '', regex=True)).fillna(0)
        
<<<<<<< HEAD
        # 7. Final Return
        available_cols = [c for c in ['Date', 'Desc', 'Amt'] if c in df.columns]
        
        if df.empty:
            raise ValueError("The file was read but contains no usable data.")
            
        return df[available_cols]

    def _categorize_expenses(self, df):
        """The Universal Mega-Taxonomy"""
        if 'Desc' not in df.columns:
            return df
            
        categories = {
            'Food & Dining': [
                'restaurant', 'cafe', 'mcdonalds', 'starbucks', 'zomato', 'swiggy', 'uber eats', 
                'food', 'pizza', 'burger', 'dining', 'doordash', 'grubhub', 'deli', 'bakery', 
                'groceries', 'supermarket', 'mart', 'dmart', 'walmart', 'kfc', 'subway'
            ],
            'Transport & Auto': [
                'uber', 'lyft', 'train', 'gas', 'shell', 'transit', 'metro', 'fuel', 'flight', 
                'petrol', 'diesel', 'taxi', 'cab', 'toll', 'parking', 'auto', 'airline', 'ola', 'irctc'
            ],
            'Utilities & Bills': [
                'electric', 'water', 'internet', 'wifi', 'telecom', 'mobile', 'bill', 'recharge', 
                'broadband', 'utility', 'trash', 'power', 'phone', 'at&t', 'verizon', 'jio', 'airtel'
            ],
            'Entertainment & Leisure': [
                'netflix', 'spotify', 'steam', 'cinema', 'movie', 'prime', 'hulu', 'gym', 'fun', 
                'hobbies', 'hobby', 'game', 'gaming', 'concert', 'event', 'club', 'bar', 'pub', 'ticket'
            ],
            'Shopping & Retail': [
                'amazon', 'target', 'flipkart', 'store', 'mall', 'clothes', 'apparel', 
                'electronics', 'shoe', 'gift', 'gifts', 'retail', 'shop', 'myntra', 'nykaa'
            ],
            'Health & Wellness': [
                'pharmacy', 'doctor', 'clinic', 'hospital', 'cvs', 'walgreens', 'health', 
                'fitness', 'yoga', 'dental', 'medical', 'medicine', 'apollo'
            ],
            'Transfers & Income': [ 
                'pocket money', 'salary', 'deposit', 'refund', 'transfer', 'cashback', 
                'venmo', 'paypal', 'zelle', 'upi', 'paytm'
            ]
        }
        
        def assign_category(desc):
            desc_lower = str(desc).lower()
            for cat, keywords in categories.items():
                if any(re.search(rf'\b{re.escape(kw)}\b', desc_lower) for kw in keywords):
                    return cat
            if any(word in desc_lower for word in ['other', 'others', 'misc', 'miscellaneous']):
                return 'Other / Misc'
            return 'Other / Misc'
            
        df['Category'] = df['Desc'].apply(assign_category)
        return df

    def run_intelligence(self, purchase_price):
        total_expense = self.df['Amt'].sum()
        total_days = 30 
        if 'Date' in self.df.columns:
            # Safely parse dates, hiding the dateutil warning
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dates = pd.to_datetime(self.df['Date'], errors='coerce', format='mixed' if int(pd.__version__.split('.')[0]) >= 2 else None).dropna()
                if not dates.empty:
                    calc_days = (dates.max() - dates.min()).days
                    total_days = calc_days if calc_days > 0 else 30

        burn_rate = total_expense / total_days
        
        freq = self.df.groupby('Desc')['Amt'].agg(['count', 'mean']).reset_index()
        exact_repeats = self.df.groupby(['Desc', 'Amt']).size().reset_index(name='count')
        self.subs = exact_repeats[exact_repeats['count'] >= 2].to_dict('records')
        self.habits = freq[freq['count'] >= 3].to_dict('records')

        mean_spend = self.df['Amt'].mean()
        std_spend = self.df['Amt'].std()
        threshold = mean_spend + (2.5 * std_spend)
        self.anomalies = self.df[self.df['Amt'] > threshold].to_dict('records')

        self.score = 100
        if 'Category' in self.df.columns and total_expense > 0:
            top_cat_amt = self.df.groupby('Category')['Amt'].sum().max()
            if (top_cat_amt / total_expense) > 0.5: self.score -= 20
        self.score -= (len(self.anomalies) * 5)
        self.score = max(10, min(100, self.score))

        projected = (burn_rate * 30)
        chart_base64 = self._generate_ui_charts()
=======
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
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4

        status = "Affordable" if float(purchase_price) < (projected * 0.5) else "Risky"
        self.prediction = {
            "burn_rate": round(burn_rate, 2), 
            "projected": round(projected, 2), 
            "status": status,
            "currency": self.currency,
<<<<<<< HEAD
            "score": int(self.score),
            "chart_img": chart_base64,
            "transaction_count": len(self.df)
        }
        return self.prediction

    def _generate_ui_charts(self):
        fig = plt.figure(figsize=(10, 4), facecolor='none')
        ax1 = fig.add_subplot(121)
        cat_expenses = self.df.groupby('Category')['Amt'].sum() if 'Category' in self.df.columns else self.df.groupby('Desc')['Amt'].sum().nlargest(5)
        if not cat_expenses.empty:
            ax1.pie(cat_expenses, labels=cat_expenses.index, autopct='%1.1f%%', startangle=140, colors=plt.cm.Pastel1.colors, textprops={'color':"w", 'fontsize': 8})
            ax1.set_title('Spending Distribution', color='white')

        ax2 = fig.add_subplot(122)
        if 'Date' in self.df.columns:
            daily = self.df.groupby('Date')['Amt'].sum()
            ax2.plot(range(len(daily)), daily.values, color='#ff7eb3', marker='o')
            ax2.set_title('Spending Trend', color='white')
            ax2.tick_params(colors='white')
            ax2.set_xticks([])
        else:
            ax2.text(0.5, 0.5, "Date Data Unavailable", color='white', ha='center')

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', transparent=True)
        plt.close()
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    def generate_pdf(self, output_path):
        """The FPDF-Safe Production Layout"""
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        pdf_currency = self.currency if self.currency not in ['₹', '₽', '€', '£', '¥'] else 'Rs. '
        if self.currency == '€': pdf_currency = 'EUR '
        if self.currency == '£': pdf_currency = 'GBP '
        if self.currency == '¥': pdf_currency = 'JPY '
        
        total_exp = self.df['Amt'].sum()
        cat_expenses = self.df.groupby('Category')['Amt'].sum() if 'Category' in self.df.columns else self.df.groupby('Desc')['Amt'].sum().nlargest(5)
        cat_expenses = cat_expenses.sort_values(ascending=False) 
        
        top_cat = cat_expenses.index[0] if not cat_expenses.empty else "Misc"
        top_pct = (cat_expenses.iloc[0] / total_exp) * 100 if total_exp > 0 and not cat_expenses.empty else 0

        plt.figure(figsize=(9, 4.5))
        bars = plt.bar(cat_expenses.index, cat_expenses.values, color='#4A90E2', width=0.6)
        plt.title('Spending Analysis', pad=20, fontsize=14, fontweight='bold', color='#333333')
        plt.xticks(rotation=35, ha='right', fontsize=10)
        plt.yticks(fontsize=10)
        
        for bar in bars:
            yval = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2.0, yval + (yval * 0.02), 
                     f'{int(yval)}', ha='center', va='bottom', fontsize=10, fontweight='bold', color='#444444')
            
        plt.tight_layout()
        chart_path = os.path.join(os.path.dirname(output_path), "pdf_bar_temp.png")
        plt.savefig(chart_path, bbox_inches='tight', facecolor='white', dpi=150)
        plt.close()

        pdf.set_font("Arial", 'B', 22)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(0, 10, "FINANCIAL INTELLIGENCE REPORT", ln=True, align='C')
        
        pdf.set_font("Arial", 'I', 12)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 8, f"(Generated Period: {datetime.now().strftime('%B %Y')})", ln=True, align='C')
        pdf.ln(5)

        pdf.set_font("Arial", 'B', 16)
        if self.score >= 80: pdf.set_text_color(46, 204, 113) 
        elif self.score >= 50: pdf.set_text_color(52, 152, 219) 
        else: pdf.set_text_color(231, 76, 60) 
        pdf.cell(0, 10, f"Financial Health Score: {int(self.score)} / 100", ln=True, align='C')
        pdf.set_text_color(0, 0, 0)
        pdf.ln(8)

        pdf.set_fill_color(245, 247, 250)
        pdf.set_draw_color(200, 200, 200)
        
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(0, 10, "  EXECUTIVE SUMMARY", border='LTR', ln=True, fill=True)
        
        pdf.set_font("Arial", '', 11)
        pdf.cell(0, 8, f"   Total Transactions : {len(self.df)}", border='LR', ln=True, fill=True)
        pdf.cell(0, 8, f"   Daily Burn Rate    : {pdf_currency}{self.prediction.get('burn_rate')}", border='LR', ln=True, fill=True)
        pdf.cell(0, 8, f"   Monthly Projection : {pdf_currency}{self.prediction.get('projected')}", border='LR', ln=True, fill=True)
        pdf.cell(0, 8, f"   Top Category       : {top_cat} ({top_pct:.1f}%)", border='LBR', ln=True, fill=True)
        pdf.ln(10)

        if os.path.exists(chart_path):
            pdf.image(chart_path, x=15, w=180)
            os.remove(chart_path)
            pdf.ln(5)

        pdf.set_font("Arial", 'B', 14)
        pdf.set_fill_color(230, 235, 245)
        pdf.cell(0, 10, " 1. Category Breakdown", ln=True, fill=True)
        pdf.ln(4)

        pdf.set_font("Arial", 'B', 11)
        pdf.set_draw_color(150, 150, 150)
        pdf.cell(80, 8, "Category", border='B')
        pdf.cell(50, 8, f"Amount ({pdf_currency.strip()})", border='B', align='R')
        pdf.cell(50, 8, "Percentage", border='B', align='R')
        pdf.ln(10)

        pdf.set_font("Arial", '', 11)
        for cat, amt in cat_expenses.items():
            pct = (amt / total_exp) * 100 if total_exp > 0 else 0
            pdf.cell(80, 8, f"  {cat}")
            pdf.cell(50, 8, f"{amt:.2f}", align='R')
            pdf.cell(50, 8, f"{pct:.1f}%", align='R')
            pdf.ln(8)
        pdf.ln(5)

        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, " 2. Key Insights", ln=True, fill=True)
        pdf.ln(4)
        pdf.set_font("Arial", '', 11)
        
        if not cat_expenses.empty:
            pdf.cell(0, 8, f"  - {top_cat} dominates your spending ({top_pct:.1f}% of total expenses).", ln=True)
            if len(cat_expenses) > 1:
                ratio = cat_expenses.iloc[0] / cat_expenses.iloc[1] if cat_expenses.iloc[1] > 0 else 0
                if ratio >= 1.5:
                    pdf.cell(0, 8, f"  - You spend ~{ratio:.1f}x more on {top_cat} compared to your 2nd highest category.", ln=True)
            if top_pct > 50:
                pdf.cell(0, 8, f"  - Spending is highly concentrated -> low diversification.", ln=True)
        pdf.ln(5)

        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, " 3. Spending Patterns", ln=True, fill=True)
        pdf.ln(4)
        pdf.set_font("Arial", '', 11)
        
        max_txn = self.df['Amt'].max()
        min_txn = self.df[self.df['Amt'] > 0]['Amt'].min() if not self.df[self.df['Amt'] > 0].empty else 0
        
        pdf.cell(0, 8, f"  - Highest Single Transaction : {pdf_currency}{max_txn}", ln=True)
        pdf.cell(0, 8, f"  - Lowest Single Transaction  : {pdf_currency}{min_txn}", ln=True)
        
        if len(self.habits) > 0:
            pdf.cell(0, 8, f"  - Frequent small expenses detected in: {self.habits[0]['Desc']}", ln=True)
        if self.anomalies:
            pdf.cell(0, 8, f"  - {len(self.anomalies)} unusually high transactions found.", ln=True)
        pdf.ln(5)

        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, " 4. Recommendations", ln=True, fill=True)
        pdf.ln(4)
        pdf.set_font("Arial", '', 11)

        pdf.set_text_color(46, 204, 113) 
        if not cat_expenses.empty:
            savings = cat_expenses.iloc[0] * 0.15
            pdf.cell(0, 8, f"  [TIP] Reduce {top_cat} spending by 15% -> Save {pdf_currency}{savings:.2f}/month", ln=True)
        if len(self.habits) > 0:
            pdf.cell(0, 8, f"  [TIP] Track frequent small expenses like '{self.habits[0]['Desc']}' closely.", ln=True)

        if self.anomalies:
            pdf.set_text_color(231, 76, 60) 
            pdf.cell(0, 8, f"  [ALERT] {len(self.anomalies)} unusually high transactions -- review immediately.", ln=True)

        pdf.set_text_color(0, 0, 0)
        pdf.ln(5)

        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, " 5. Financial Health Breakdown", ln=True, fill=True)
        pdf.ln(4)
        pdf.set_font("Arial", '', 11)

        cat_balance = 100 - (20 if top_pct > 50 else 0)
        spend_control = 100 - (15 if self.prediction.get('burn_rate') > 100 else 0)
        risk_level = "High" if len(self.anomalies) > 2 else ("Moderate" if len(self.anomalies) > 0 else "Low")

        pdf.cell(60, 8, "  Category Balance")
        pdf.cell(0, 8, f": {cat_balance} / 100", ln=True)
        
        pdf.cell(60, 8, "  Spending Control")
        pdf.cell(0, 8, f": {spend_control} / 100", ln=True)
        
        pdf.cell(60, 8, "  Risk Level")
        pdf.cell(0, 8, f": {risk_level}", ln=True)

        pdf.set_y(-15)
        pdf.set_font('Arial', 'I', 8)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 10, 'Generated by ToolSuite | Smart Expense Analyzer', 0, 0, 'C')

=======
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
>>>>>>> c92ab8401fdf1d0d1268fe68e703ad6c984e99e4
        pdf.output(output_path)