from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import datetime
import random
import statistics
import requests
import json

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


HF_API_KEY = os.getenv("HF_API_KEY")
HF_MODEL = os.getenv("HF_MODEL", "google/flan-t5-large")

def load_stocks_from_json(filepath="mock_stocks.json"):
    """Load stock data from JSON file. Falls back to empty list if file not found."""
    try:
        
        script_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(script_dir, filepath)
        
        if os.path.exists(full_path):
            with open(full_path, 'r') as f:
                data = json.load(f)
                return data.get("stocks", [])
        else:
            print(f"Warning: {filepath} not found at {full_path}")
            return []
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return []

stocks = load_stocks_from_json("mock_stocks.json")


def generate_history_matching_end(days=180, end_price=100.0, end_date=None):
    """Generate a realistic random-walk history of length `days` that ends near `end_price`.
    This generates a walk then scales it so the final value equals end_price (preserves shape)."""
    if end_date is None:
        end_date = datetime.date.today()

    vals = []
    p = 100.0
    for _ in range(days):
        change_pct = random.uniform(-0.015, 0.02)
        p = max(1.0, p * (1 + change_pct))
        vals.append(p)
    gen_last = vals[-1] if vals else 1.0
    scale = (end_price / gen_last) if gen_last else 1.0
    scaled = [round(v * scale, 2) for v in vals]
    history = []
    for i, price in enumerate(scaled):
        d = end_date - datetime.timedelta(days=(days - 1 - i))
        history.append({"date": d.isoformat(), "price": price})
    return history

def ensure_six_months_and_persist(stocks_list, filepath="mock_stocks.json", days=180, end_date=None):
    """Make sure each stock has `days` history ending at `end_date` (or today); update fields and persist back to JSON."""
    updated = False
    for s in stocks_list:
        end_price = s.get('price') or (s.get('history') and s['history'][-1]['price']) or round(random.uniform(10, 500), 2)
        hist = s.get('history') or []
       
        needs = False
        try:
            if len(hist) < days:
                needs = True
            else:
                last_date = datetime.date.fromisoformat(hist[-1]['date'])
                if last_date < datetime.date.today():
                    needs = True
        except Exception:
            needs = True

        if needs:
            new_hist = generate_history_matching_end(days=days, end_price=end_price, end_date=end_date)
            s['history'] = new_hist
            s['price'] = new_hist[-1]['price']
            prev = new_hist[-2]['price'] if len(new_hist) > 1 else new_hist[-1]['price']
            s['change'] = round(((s['price'] - prev) / prev) * 100, 2) if prev else 0.0
    
            if 'volume' not in s or not s['volume']:
                s['volume'] = random.randint(5_000_000, 200_000_000)
            if 'market_cap' not in s or not s['market_cap']:
                s['market_cap'] = random.randint(10_000_000_000, 2_000_000_000_000)
            updated = True

    if updated:
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            full_path = os.path.join(script_dir, filepath)
            with open(full_path, 'w') as f:
                json.dump({"stocks": stocks_list}, f, indent=2)
            print(f"Updated and wrote {filepath} with {len(stocks_list)} stocks (each {days} days history).")
        except Exception as e:
            print(f"Failed to write updated JSON file: {e}")

fixed_start = datetime.date(2025, 8, 1)
fixed_end = datetime.date(2026, 1, 31)
fixed_days = (fixed_end - fixed_start).days + 1
ensure_six_months_and_persist(stocks, "mock_stocks.json", days=fixed_days, end_date=fixed_end)

@app.get("/api/stocks/top10")
def top10(by: str = "volume"):
    """Return top 10 stocks sorted by 'volume', 'growth', or 'market_cap'."""
    by = by.lower()
    if by == "growth":
        def metric(s):
            h = s["history"]
            return (h[-1]["price"] - h[0]["price"]) / h[0]["price"] if h and h[0]["price"] else 0
    elif by == "market_cap":
        def metric(s):
            return s.get("market_cap", 0)
    else:
        def metric(s):
            return s.get("volume", 0)

    sorted_stocks = sorted(stocks, key=metric, reverse=True)

    return [
        {
            "ticker": s["ticker"],
            "company": s["company"],
            "price": s["price"],
            "change": s["change"],
            "volume": s["volume"],
            "market_cap": s.get("market_cap")
        }
        for s in sorted_stocks[:10]
    ]

@app.get("/api/stocks/{ticker}/history")
def stock_history(ticker: str):
    t = ticker.upper()
    for stock in stocks:
        if stock["ticker"] == t:
            return {"ticker": t, "history": stock["history"]}
    raise HTTPException(status_code=404, detail="Stock not found")

class AnalysisResponse(BaseModel):
    ticker: str
    trend: str
    risk_level: str
    suggested_action: str
    explanation: str
    disclaimer: str

@app.post("/api/stocks/{ticker}/analyze", response_model=AnalysisResponse)
def analyze_stock(ticker: str):
    t = ticker.upper()
    
    for stock in stocks:
        if stock["ticker"] == t:
            history = stock["history"]
            break
    else:
        raise HTTPException(status_code=404, detail="Stock not found")

   
    def fallback_analysis(history):
        prices = [p["price"] for p in history]
        start = prices[0]
        end = prices[-1]
        pct = ((end - start) / start) * 100 if start else 0
        trend = "Sideways"
        if pct > 5:
            trend = "Upward"
        elif pct < -5:
            trend = "Downward"
        vol = statistics.pstdev(prices) if len(prices) > 1 else 0
        rel_vol = vol / (statistics.mean(prices) if statistics.mean(prices) else 1)
        if rel_vol < 0.02:
            risk = "Low"
        elif rel_vol < 0.06:
            risk = "Medium"
        else:
            risk = "High"
        action = "Long-term investment" if trend == "Upward" and risk != "High" else ("Avoid" if risk == "High" and trend == "Downward" else "Short-term watch")
        
        return { 
            "ticker": t,
            "trend": trend,
            "risk_level": risk,
            "suggested_action": action,
            "explanation": f"Price changed {round(pct,2)}% over 6 months. Volatility metric {round(rel_vol,4)}.",
            "disclaimer": "This is AI-generated analysis and not financial advice."
        }

    if not HF_API_KEY:
        return fallback_analysis(history)

    # build prompt asking the model to return a JSON object
    prompt_lines = [f"Analyze the following 6 months stock price data for {t} and return a JSON object with keys: trend (Upward/Downward/Sideways), risk_level (Low/Medium/High), suggested_action (Long-term investment/Short-term watch/Avoid), explanation. Do NOT include any extra text. The JSON must be parsable.", "Prices:"]
    for item in history:
        prompt_lines.append(f"{item['date']},{item['price']}")
    prompt = "\n".join(prompt_lines)

    headers = {"Authorization": f"Bearer {HF_API_KEY}", "Content-Type": "application/json"}
    body = {"inputs": prompt, "parameters": {"max_new_tokens": 256}}
    try:
        resp = requests.post(f"https://api-inference.huggingface.co/models/{HF_MODEL}", headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # extract text from common response formats
        if isinstance(data, dict) and "error" in data:
            raise Exception(data["error"])
        text = ""
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            text = data[0].get("generated_text") or data[0].get("generated_text") or json.dumps(data[0])
        elif isinstance(data, dict) and "generated_text" in data:
            text = data.get("generated_text", "")
        elif isinstance(data, str):
            text = data
        else:
            text = json.dumps(data)

        # attempt to find a JSON substring
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            json_str = text[start:end+1]
            parsed = json.loads(json_str)
            # normalize keys
            return {
                "ticker": t,
                "trend": parsed.get("trend", parsed.get("Trend", "Sideways")),
                "risk_level": parsed.get("risk_level", parsed.get("Risk", "Medium")),
                "suggested_action": parsed.get("suggested_action", parsed.get("Action", "Short-term watch")),
                "explanation": parsed.get("explanation", ""),
                "disclaimer": "This is AI-generated analysis and not financial advice."
            }
        else:
            # fallback on simple heuristic
            return fallback_analysis(history)
    except Exception as e:
        print("HF API call failed:", e)
        return fallback_analysis(history)

# Duplicate example block removed. The main app and endpoints are defined above. Ensure only one `app = FastAPI()` exists to avoid route overrides.
# Use `/api/stocks/top10`, `/api/stocks/{ticker}/history`, `/api/stocks/{ticker}/analyze` implemented above.

