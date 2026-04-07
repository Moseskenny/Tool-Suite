import pandas as pd
from fpdf import FPDF
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime
import os
import re
import io
import base64
import warnings

class ExpenseAnalyzer:
    def __init__(self, csv_path, is_splitwise=False):
        self.currency = "" 
        self.df = self._huntsman_load(csv_path, is_splitwise)
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
            encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin1', 'iso-8859-1']
            for enc in encodings:
                try:
                    df = pd.read_csv(path, sep=None, engine='python', encoding=enc, on_bad_lines='skip')
                    break
                except Exception:
                    continue

        if df is None or df.empty:
            raise ValueError("Critical Error: Could not read the file.")

        # 3. Clean garbage metadata and lowercase headers
        df = df.dropna(how='all').dropna(axis=1, how='all')
        df.columns = [str(c).strip().lower() for c in df.columns]

        # 4. Extraction Mapping
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
        
        # 5. Currency Detection
        symbols = ['$', '€', '£', '₹', '¥', '₽', '₩', 'A$', 'C$', 'Rs']
        for col_name in df.columns:
            for sym in symbols:
                if sym in col_name:
                    self.currency = sym
                    break
        
        df = df.rename(columns=mapping)
        
        if not self.currency:
            raw_amounts = df['Amt'].astype(str)
            for sym in symbols:
                if raw_amounts.str.contains(re.escape(sym), case=False).any():
                    self.currency = sym
                    break
        if not self.currency:
            self.currency = "₹" 

        # 6. Data Sanitization
        df['Amt'] = pd.to_numeric(df['Amt'].astype(str).str.replace(r'[^\d.-]', '', regex=True), errors='coerce').fillna(0)
        
        if 'Desc' in df.columns:
            df['Desc'] = df['Desc'].fillna('Unknown').astype(str)
            df['Desc'] = df['Desc'].replace(r'^\s*$', 'Unknown', regex=True)
            
        if is_splitwise:
            share_col = [c for c in df.columns if 'share' in str(c).lower()]
            if share_col: 
                df['Amt'] = pd.to_numeric(df[share_col[0]].astype(str).str.replace(r'[^\d.-]', '', regex=True)).fillna(0)
        
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

        status = "Affordable" if float(purchase_price) < (projected * 0.5) else "Risky"
        self.prediction = {
            "burn_rate": round(burn_rate, 2), 
            "projected": round(projected, 2), 
            "status": status,
            "currency": self.currency,
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

        pdf.output(output_path)