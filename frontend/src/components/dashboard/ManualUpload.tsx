import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, RefreshCcw, Cloud } from 'lucide-react';
import api from '../../services/api';

interface ManualUploadProps {
    onClose: () => void;
    onSuccess: () => void;
}

const ManualUpload: React.FC<ManualUploadProps> = ({ onClose, onSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadType, setUploadType] = useState<'invoice' | 'footfall'>('invoice');
    const [syncingFootfall, setSyncingFootfall] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; rows?: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFootfallAutoSync = async () => {
        setSyncingFootfall(true);
        setResult(null);
        
        try {
            const response = await api.post('/ingest/sync/footfall');
            setResult({
                success: true,
                message: response.data.message,
                rows: response.data.rows_added
            });
        } catch (error: any) {
            setResult({
                success: false,
                message: error.response?.data?.message || error.message || 'Footfall sync failed'
            });
        } finally {
            setSyncingFootfall(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            setResult({ success: false, message: 'Please select a CSV file' });
            return;
        }

        setUploading(true);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const endpoint = uploadType === 'invoice' ? '/ingest/upload/invoice' : '/ingest/upload/footfall';
            const response = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResult({
                success: true,
                message: response.data.message,
                rows: response.data.rows_added
            });

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error: any) {
            setResult({
                success: false,
                message: error.response?.data?.message || error.message || 'Upload failed'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDone = () => {
        if (result?.success) {
            onSuccess();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Upload className="text-white" size={24} />
                        <h2 className="text-xl font-bold text-white">Manual Data Upload</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Upload Type Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Select Report Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setUploadType('invoice')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    uploadType === 'invoice'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                            >
                                <FileSpreadsheet size={24} className="mx-auto mb-2" />
                                <div className="font-semibold">Invoice Details</div>
                                <div className="text-xs mt-1 opacity-70">Sales transactions</div>
                            </button>
                            <button
                                onClick={() => setUploadType('footfall')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    uploadType === 'footfall'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                            >
                                <FileSpreadsheet size={24} className="mx-auto mb-2" />
                                <div className="font-semibold">Footfall Data</div>
                                <div className="text-xs mt-1 opacity-70">Store traffic data</div>
                            </button>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Upload CSV File
                        </label>
                        <div className="relative">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                                    uploading
                                        ? 'border-slate-300 bg-slate-50 cursor-not-allowed'
                                        : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                            >
                                {uploading ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                                        <span className="text-sm text-slate-500">Uploading & Processing...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Upload size={32} className="text-slate-400 mb-2" />
                                        <span className="text-sm font-medium text-slate-600">
                                            Click to select CSV file
                                        </span>
                                        <span className="text-xs text-slate-400 mt-1">
                                            Max file size: 50MB
                                        </span>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Result Message */}
                    {result && (
                        <div
                            className={`p-4 rounded-xl flex items-start gap-3 ${
                                result.success
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-red-50 border border-red-200'
                            }`}
                        >
                            {result.success ? (
                                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                            ) : (
                                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                            )}
                            <div>
                                <div className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {result.success ? 'Upload Successful!' : 'Upload Failed'}
                                </div>
                                <div className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                                    {result.message}
                                </div>
                                {result.rows !== undefined && (
                                    <div className="text-sm text-green-600 mt-1">
                                        {result.rows.toLocaleString()} records processed
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Help Text */}
                    <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
                        <div className="font-semibold mb-2">Expected File Formats:</div>
                        <ul className="space-y-1 text-xs">
                            <li>• <strong>Invoice Details:</strong> Export from Olabi Portal → Reports → Invoice Detail</li>
                            <li>• <strong>Footfall Data:</strong> CSV with columns: Date, Store Name, Total IN</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    {result?.success && (
                        <button
                            onClick={handleDone}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Done & Refresh
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualUpload;
