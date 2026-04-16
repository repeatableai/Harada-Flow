/**
 * Registry Sidebar (B.6)
 *
 * Displays artifact registry entries for the current engagement.
 * Mode column shows Executive vs Working.
 * Download button for ACD when available.
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  FileSpreadsheet,
  File,
  Crown,
  Zap,
  Download,
} from 'lucide-react';

const TYPE_ICONS = {
  HTML: FileText,
  XLSX: FileSpreadsheet,
  DOCX: FileText,
  PDF: File,
  MD: FileText,
};

const ACD_COLORS = {
  'N/A': 'text-gray-400',
  'Required': 'text-amber-400',
  'Pending': 'text-amber-400',
  'Complete': 'text-green-400',
  'Declined': 'text-red-400',
};

export default function RegistrySidebar({ companyId }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (companyId) loadEntries();
  }, [companyId]);

  const loadEntries = async () => {
    try {
      const result = await apiClient.request(`/deliverable/registry?companyId=${companyId}`);
      setEntries(result.data || result || []);
    } catch {
      // Registry may not have entries yet
    }
  };

  const handleDownloadAcd = async (entry) => {
    try {
      const response = await fetch(`/api/deliverable/registry/${entry.id}/acd`, {
        headers: {
          'Authorization': `Bearer ${apiClient.accessToken}`,
        },
      });
      if (!response.ok) throw new Error('ACD not available');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entry.name.replace(/[^a-zA-Z0-9]/g, '_')}_ACD.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // ACD not available yet
    }
  };

  if (entries.length === 0) return null;

  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
      <h4 className="text-white text-xs font-semibold flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-blue-400" />
        Artifact Registry ({entries.length})
      </h4>

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {entries.map(entry => {
          const Icon = TYPE_ICONS[entry.type] || File;
          return (
            <div key={entry.id} className="flex items-center gap-2 p-1.5 bg-white/5 rounded text-xs">
              <Icon className="w-3 h-3 text-blue-300 flex-shrink-0" />
              <span className="text-white truncate flex-1">{entry.name}</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
                entry.mode === 'Executive' ? 'border-purple-500/50 text-purple-300' : 'border-blue-500/50 text-blue-300'
              }`}>
                {entry.mode === 'Executive' ? <Crown className="w-2.5 h-2.5 mr-0.5" /> : <Zap className="w-2.5 h-2.5 mr-0.5" />}
                {entry.mode}
              </Badge>
              <span className={`text-[10px] ${ACD_COLORS[entry.acdStatus] || 'text-gray-400'}`}>
                ACD: {entry.acdStatus}
              </span>
              {entry.acdStatus === 'Complete' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownloadAcd(entry)}
                  className="h-5 w-5 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  title="Download ACD"
                >
                  <Download className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
