import React, { useState, useEffect } from 'react';
import { alertService } from '../../services/alertService';

const AlertsTab = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState('');
  const [condition, setCondition] = useState('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await alertService.getAlerts();
      if (res.data) setAlerts(res.data);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!ticker || !targetPrice) return;
    
    setCreating(true);
    try {
      await alertService.createAlert({
        ticker,
        condition,
        target_price: parseFloat(targetPrice)
      });
      setTicker('');
      setTargetPrice('');
      fetchAlerts(); // refresh
    } catch (err) {
      console.error("Failed to create alert", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertService.deleteAlert(id);
      setAlerts(alerts.filter(a => a.id !== id));
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Alert Form */}
      <div className="glass-panel p-6 rounded-xl border border-outline-variant/10">
        <h3 className="text-lg font-bold text-on-surface mb-4">Create New Alert</h3>
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Ticker</label>
            <input 
              type="text" 
              placeholder="e.g. BBCA" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full bg-surface-container border-none text-sm rounded-lg focus:ring-1 focus:ring-primary py-2 px-4 outline-none uppercase placeholder:normal-case"
              required
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Condition</label>
            <select 
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-surface-container border-none text-sm rounded-lg focus:ring-1 focus:ring-primary py-2 px-4 outline-none cursor-pointer"
            >
              <option value="above">Price goes Above</option>
              <option value="below">Price goes Below</option>
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Target Price (Rp)</label>
            <input 
              type="number" 
              placeholder="e.g. 10500" 
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full bg-surface-container border-none text-sm rounded-lg focus:ring-1 focus:ring-primary py-2 px-4 outline-none"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={creating}
            className="w-full md:w-auto bg-primary hover:brightness-110 text-on-primary px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {creating ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">add_alert</span>}
            Set Alert
          </button>
        </form>
      </div>

      {/* Alerts List */}
      <div className="glass-panel rounded-xl overflow-hidden border border-outline-variant/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high/50 text-[10px] font-bold uppercase tracking-widest text-outline">
              <th className="px-6 py-4">Ticker</th>
              <th className="px-6 py-4 text-center">Condition</th>
              <th className="px-6 py-4 text-right">Target Price</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          {loading ? (
             <tbody>
                <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-on-surface-variant">Loading your alerts...</td></tr>
             </tbody>
          ) : alerts.length === 0 ? (
             <tbody>
                <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-on-surface-variant">You have no active price alerts.</td></tr>
             </tbody>
          ) : (
          <tbody className="text-sm tabular-nums">
            {alerts.map((a) => (
              <tr key={a.id} className="group hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-0">
                <td className="px-6 py-4 font-bold text-on-surface">{a.ticker}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${a.condition === 'above' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                    {a.condition === 'above' ? '≥ Above' : '≤ Below'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-semibold">Rp {a.target_price.toLocaleString()}</td>
                <td className="px-6 py-4 text-center">
                  {a.triggered ? (
                    <span className="text-[10px] font-bold uppercase text-tertiary">Triggered</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-md hover:bg-error/20 text-error/70 hover:text-error transition-colors" title="Delete Alert">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          )}
        </table>
      </div>
    </div>
  );
};

export default AlertsTab;
