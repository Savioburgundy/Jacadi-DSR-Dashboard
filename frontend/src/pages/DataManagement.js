import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Users
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function DataManagement() {
  const { token, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [uploading, setUploading] = useState({ sales: false, footfall: false });
  
  const salesFileRef = useRef(null);
  const footfallFileRef = useRef(null);

  const fetchSyncLogs = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/data/sync-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncLogs(response.data);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchSyncLogs();
  }, [fetchSyncLogs]);

  const handleSalesUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, sales: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/data/upload-sales`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(`Sales data uploaded: ${response.data.records_processed} records processed`);
      fetchSyncLogs();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to upload sales data';
      toast.error(message);
    } finally {
      setUploading(prev => ({ ...prev, sales: false }));
      if (salesFileRef.current) salesFileRef.current.value = '';
    }
  };

  const handleFootfallUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, footfall: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/data/upload-footfall`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(`Footfall data uploaded: ${response.data.records_processed} records processed`);
      fetchSyncLogs();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to upload footfall data';
      toast.error(message);
    } finally {
      setUploading(prev => ({ ...prev, footfall: false }));
      if (footfallFileRef.current) footfallFileRef.current.value = '';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6" data-testid="data-management-page">
      {/* Page Header */}
      <div>
        <h1 className="font-outfit text-2xl lg:text-3xl font-bold text-white">
          Data Management
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload sales and footfall data
        </p>
      </div>

      {/* Upload Cards */}
      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sales CSV Upload */}
          <div className="glass-card p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#D70075]/20">
                <Database className="w-6 h-6 text-[#D70075]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Sales Data</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Upload CSV with invoice details. Supports deduplication by invoice number.
                </p>
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleSalesUpload}
                  ref={salesFileRef}
                  className="hidden"
                  id="sales-upload"
                  data-testid="sales-file-input"
                />
                <label htmlFor="sales-upload">
                  <Button
                    asChild
                    disabled={uploading.sales}
                    className="btn-primary cursor-pointer"
                    data-testid="upload-sales-btn"
                  >
                    <span>
                      {uploading.sales ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Sales CSV
                        </>
                      )}
                    </span>
                  </Button>
                </label>

                <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <p className="text-xs text-slate-500 font-medium mb-2">Expected Columns:</p>
                  <p className="text-xs text-slate-400">
                    Invoice Number, Transaction Type, Transaction Date, Store, Channel, Gross Quantity, Net Quantity, Nett Invoice Value
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footfall CSV Upload */}
          <div className="glass-card p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#38BDF8]/20">
                <Users className="w-6 h-6 text-[#38BDF8]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Footfall Data</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Upload daily footfall counts by store for conversion calculation.
                </p>
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFootfallUpload}
                  ref={footfallFileRef}
                  className="hidden"
                  id="footfall-upload"
                  data-testid="footfall-file-input"
                />
                <label htmlFor="footfall-upload">
                  <Button
                    asChild
                    disabled={uploading.footfall}
                    className="btn-secondary cursor-pointer"
                    data-testid="upload-footfall-btn"
                  >
                    <span>
                      {uploading.footfall ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Footfall CSV
                        </>
                      )}
                    </span>
                  </Button>
                </label>

                <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <p className="text-xs text-slate-500 font-medium mb-2">Expected Columns:</p>
                  <p className="text-xs text-slate-400">
                    Date, Store, Footfall
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Admin Access Required</h3>
          <p className="text-slate-400">
            Only administrators can upload data. Contact your admin for access.
          </p>
        </div>
      )}

      {/* Sync History */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Upload History</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSyncLogs}
            className="text-slate-400 hover:text-white"
            data-testid="refresh-logs-btn"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Type</TableHead>
              <TableHead className="text-slate-400">Records</TableHead>
              <TableHead className="text-slate-400">Triggered By</TableHead>
              <TableHead className="text-slate-400">Started</TableHead>
              <TableHead className="text-slate-400">Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syncLogs.length === 0 ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No upload history yet
                </TableCell>
              </TableRow>
            ) : (
              syncLogs.map((log) => (
                <TableRow key={log.id} className="border-white/5 hover:bg-white/5">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className="capitalize text-slate-300">{log.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300 capitalize">
                    {log.sync_type?.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="text-white font-medium">
                    {log.records_processed?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {log.triggered_by || '-'}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {formatDate(log.started_at)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {formatDate(log.completed_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* CSV Format Help */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">CSV Format Guidelines</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#D70075] mb-3">Sales CSV Example</h4>
            <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{`Invoice Number,Transaction Type,Transaction Date,Store,Channel,Gross Quantity,Net Quantity,Nett Invoice Value
INV001,IV,2024-01-15,Jacadi Palladium,Store,3,3,15000
INV002,IR,2024-01-15,Jacadi MOA,E-com,-1,-1,-5000
INV003,IV,2024-01-16,Shopify Webstore,WhatsApp,2,2,8500`}</pre>
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#38BDF8] mb-3">Footfall CSV Example</h4>
            <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{`Date,Store,Footfall
2024-01-15,Jacadi Palladium,450
2024-01-15,Jacadi MOA,380
2024-01-16,Jacadi Palladium,520
2024-01-16,Jacadi MOA,410`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
