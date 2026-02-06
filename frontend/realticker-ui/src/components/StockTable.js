import React, { useEffect, useState } from "react";
import axios from "axios";

function formatNumber(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export default function StockTable({ onSelectStock }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [by, setBy] = useState('volume');

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`http://127.0.0.1:8000/api/stocks/top10?by=${by}`)
      .then(res => setStocks(res.data))
      .catch(err => setError(err.message || 'Failed to fetch'))
      .finally(() => setLoading(false));
  }, [by]);

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">Top 10 Stocks</h2>
        <div className="d-flex align-items-center">
          <label className="me-2 mb-0">Rank by:</label>
          <select value={by} onChange={e => setBy(e.target.value)} className="form-select form-select-sm">
            <option value="volume">Highest Volume</option>
            <option value="growth">Highest Growth (6m)</option>
            <option value="market_cap">Market Cap</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="p-3"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>
      )}

      {error && <div className="alert alert-danger">Error: {error}</div>}

      {!loading && !error && (
        <table className="table table-hover table-sm">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Price</th>
              <th>Change %</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map(stock => (
              <tr key={stock.ticker} onClick={() => onSelectStock(stock.ticker)} style={{cursor: 'pointer'}}>
                <td className="fw-semibold">{stock.ticker}</td>
                <td>{stock.company}</td>
                <td>${stock.price.toFixed(2)}</td>
                <td className={stock.change >= 0 ? 'text-success' : 'text-danger'}>{stock.change >= 0 ? '+' : ''}{stock.change}%</td>
                <td>{formatNumber(stock.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
} 
