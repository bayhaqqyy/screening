import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

const AlertNotification = () => {
  const [alerts, setAlerts] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    const handleAlert = (e) => {
      const payload = e.detail;
      // Filter out alerts meant for other users
      if (payload.data && payload.data.user_id === user?.id) {
        const newAlert = payload.data;
        
        setAlerts(prev => [...prev, { ...newAlert, _id: Date.now() }]);

        // Auto remove after 5 seconds
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a._id !== newAlert._id));
        }, 5000);
      }
    };

    window.addEventListener('ws_ALERT_TRIGGERED', handleAlert);
    return () => window.removeEventListener('ws_ALERT_TRIGGERED', handleAlert);
  }, [user]);

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(a => a._id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {alerts.map(alert => (
          <motion.div
            key={alert._id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto bg-surface-container-highest border border-outline-variant/20 shadow-2xl rounded-xl p-4 w-80 flex items-start gap-4 backdrop-blur-xl"
          >
            <div className="bg-primary/20 p-2 rounded-full flex-shrink-0">
              <span className="material-symbols-outlined text-primary">notifications_active</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-on-surface text-sm">Target Triggered!</h4>
              <p className="text-on-surface-variant text-xs mt-1">
                <span className="font-bold text-on-surface">{alert.ticker}</span> has just crossed {alert.condition === 'above' ? 'above' : 'below'}{' '}
                <span className="font-bold tabular-nums">Rp {alert.target_price.toLocaleString()}</span>.
              </p>
            </div>
            <button onClick={() => removeAlert(alert._id)} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AlertNotification;
