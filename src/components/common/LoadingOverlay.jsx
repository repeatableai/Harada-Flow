import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function LoadingOverlay({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-white/10 backdrop-blur-lg border-white/20 rounded-2xl p-8 max-w-md mx-4 text-center"
      >
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-ping opacity-20"></div>
          </div>
        </div>
        
        {/* Repeatable AI Logo */}
        <div className="flex items-center justify-center space-x-2 mb-4 opacity-80">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/199aedeea_FinalRepeatableLogowithoutbackground1.png"
            alt="Repeatable AI"
            className="h-8 w-auto"
          />
        </div>
        
        <h3 className="text-white font-bold text-lg mb-2">AI at Work</h3>
        <p className="text-blue-200 mb-4">{message}</p>
        <div className="flex justify-center">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}