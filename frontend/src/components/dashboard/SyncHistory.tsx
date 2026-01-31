import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, RefreshCcw, FileText, Database } from 'lucide-react';
import api from '../../services/api';

interface SyncLog {
    id: string;
    filename: string;
    status: string;
    rows_added: number;
    error_message: string | null;
    created_at: string;
}

interface SyncHistoryProps {
    onClose: () => void;
}

const SyncHistory: React.FC<SyncHistoryProps> = ({ onClose }) => {
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/ingest/logs');
            setLogs(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch sync logs');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'success':
                return <CheckCircle className="text-emerald-500" size={18} />;
            case 'failed':
                return <XCircle className="text-red-500" size={18} />;
            default:
                return <Clock className="text-amber-500" size={18} />;
        }
    };

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-bold uppercase";
        switch (status.toLowerCase()) {
            case 'success':
                return `${baseClasses} bg-emerald-100 text-emerald-700`;
            case 'failed':
                return `${baseClasses} bg-red-100 text-red-700`;
            default:
                return `${baseClasses} bg-amber-100 text-amber-700`;
        }
    };

    // Stats
    const totalSyncs = logs.length;
    const successfulSyncs = logs.filter(l => l.status.toLowerCase() === 'success').length;
    const totalRowsAdded = logs.reduce((acc, l) => acc + (l.rows_added || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Database className="text-white" size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-white">Sync History</h2>
                            <p className="text-blue-100 text-sm">Recent data ingestion logs</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Stats Bar */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm text-slate-600">Total Syncs:</span>
                            <span className="font-bold text-slate-800">{totalSyncs}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-sm text-slate-600">Successful:</span>
                            <span className="font-bold text-emerald-600">{successfulSyncs}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm text-slate-600">Total Rows:</span>
                            <span className="font-bold text-purple-600">{totalRowsAdded.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={fetchLogs}
                            className="ml-auto flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            <RefreshCcw size={14} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="mt-4 text-slate-500">Loading sync history...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <XCircle className="mx-auto text-red-400" size={48} />
                            <p className="mt-4 text-red-600">{error}</p>
                            <button
                                onClick={fetchLogs}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="mx-auto text-slate-300" size={48} />
                            <p className="mt-4 text-slate-500">No sync history yet</p>
                            <p className="text-sm text-slate-400">Click "Sync Data" to start ingesting data</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                                    <th className="pb-3 font-bold">Status</th>
                                    <th className="pb-3 font-bold">Filename</th>
                                    <th className="pb-3 font-bold text-right">Rows Added</th>
                                    <th className="pb-3 font-bold">Date & Time</th>
                                    <th className="pb-3 font-bold">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(log.status)}
                                                <span className={getStatusBadge(log.status)}>
                                                    {log.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <span className="font-mono text-sm text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                                {log.filename.length > 40 
                                                    ? log.filename.substring(0, 40) + '...' 
                                                    : log.filename}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className="font-bold text-slate-800">
                                                {(log.rows_added || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="py-3 text-sm text-slate-600">
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td className="py-3">
                                            {log.error_message ? (
                                                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded max-w-[200px] truncate block">
                                                    {log.error_message}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SyncHistory;
