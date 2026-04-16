import React from 'react';
import { motion } from 'framer-motion';

const FloatingActionButton = () => {
  return (
    <div className="fixed bottom-8 right-8 z-50">
      <motion.button 
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
        className="signature-gradient w-14 h-14 rounded-full shadow-xl shadow-primary-container/20 flex items-center justify-center text-on-primary group"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </motion.button>
    </div>
  );
};

export default FloatingActionButton;
