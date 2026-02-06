import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function formatDateShort(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function aggregateMonthly(history){
  const map = new Map();
  history.forEach(item => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${d.getMonth()+1}`;
    if (!map.has(key) || new Date(item.date) > new Date(map.get(key).date)){
      map.set(key, item);
    }
  });
  return Array.from(map.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
}

function PriceChart({ data = [] }) {
  if (!data || data.length === 0) return null;
  const chartData = data.map(d => ({ date: d.date, price: d.price }));
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(iso) => {
            try { return new Date(iso).toLocaleString(undefined, { month: 'short' }); } catch { return iso; }
          }} minTickGap={20} />
          <YAxis domain={["dataMin", "dataMax"]} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(value) => [`$${value}`, 'Price']} labelFormatter={(l) => {
            try { return new Date(l).toLocaleString(undefined, { month: 'short', day: 'numeric' }); } catch { return l; }
          }} />
          <Line type="monotone" dataKey="price" stroke="#0d6efd" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 

export default function StockDetail({ ticker }) {
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setError(null);
    setLoadingHistory(true);
    setLoadingAnalysis(true);
    setHistory([]);
    setAnalysis(null);

    axios.get(`http://127.0.0.1:8000/api/stocks/${ticker}/history`)
      .then(res => setHistory(res.data.history))
      .catch(err => setError(err.message || 'Failed to fetch history'))
      .finally(() => setLoadingHistory(false));

    axios.post(`http://127.0.0.1:8000/api/stocks/${ticker}/analyze`)
      .then(res => setAnalysis(res.data))
      .catch(err => setError(err.message || 'Analysis failed'))
      .finally(() => setLoadingAnalysis(false));
  }, [ticker]);

  const stats = useMemo(() => {
    if (!history || history.length < 2) return null;
    const start = history[0].price;
    const end = history[history.length - 1].price;
    const pct = ((end - start) / start) * 100;
    return { start, end, pct: pct.toFixed(2) };
  }, [history]);

  if (!ticker) return null;

  return (
    <div className="card mt-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="card-title mb-0">{ticker} — Last 6 months</h5>
          <small className="text-muted">{loadingHistory ? 'Loading...' : ''}</small>
        </div>

        {error && <div className="alert alert-danger">Error: {error}</div>}

        {history && history.length > 0 && (
          <div>
            <div className="mb-2">
              {(() => {
                const monthly = aggregateMonthly(history);
                const monthlyDisplay = monthly.slice(-6);
                return <PriceChart data={monthlyDisplay} />;
              })()}
            </div>
            <div className="text-muted small">Start: ${stats.start} • End: ${stats.end} • Change: {stats.pct}%</div>
          </div>
        )}

        <div className="mt-3">
          {loadingAnalysis && (
            <div className="d-flex align-items-center"><div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>Analyzing with AI...</div>
          )}

          {analysis && (
            <div className="border rounded p-3 bg-light">
              <h6>AI Analysis</h6>
              <p className="mb-1"><strong>Trend:</strong> {analysis.trend}</p>
              <p className="mb-1"><strong>Risk:</strong> {analysis.risk_level}</p>
              <p className="mb-1"><strong>Suggested action:</strong> {analysis.suggested_action}</p>
              {analysis.explanation && <p className="mt-2 small text-muted">{analysis.explanation}</p>}
              <p className="mt-3 small text-muted">{analysis.disclaimer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
