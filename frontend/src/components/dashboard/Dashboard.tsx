// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, DollarSign, ShoppingCart, Users, BarChart2, ArrowRight, Clock, UserCog, Info, ArrowUpRight, ArrowDownRight, ChevronDown, RefreshCcw, History, Upload, Download } from 'lucide-react';
import api from '../../services/api';
import UserManagement from '../admin/UserManagement';
import SyncHistory from './SyncHistory';
import Analytics from './Analytics';
import ManualUpload from './ManualUpload';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Export to CSV utility function
const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
    if (!data || data.length === 0) {
        alert('No data to export');
        return;
    }
    
    const keys = headers || Object.keys(data[0]);
    const csvHeaders = keys.join(',');
    const csvRows = data.map(row => 
        keys.map(key => {
            const value = row[key];
            // Handle values with commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
        }).join(',')
    );
    
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Export Button Component
const ExportButton = ({ onClick, label = "Export CSV" }: { onClick: () => void, label?: string }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-all"
    >
        <Download size={14} />
        {label}
    </button>
);

interface DashboardProps {
    currentRole?: string;
}

// Data Interfaces
interface RetailWhatsappRow {
    Location: string;
    MTD_RETAIL_SALE: number;
    MTD_WHATSAPP_SALE: number;
    MTD_RETAIL_TRX: number;
    MTD_WHATSAPP_TRX: number;
    PM_RETAIL_SALE: number;
    PM_WHATSAPP_SALE: number;
    PM_RETAIL_TRX: number;
    PM_WHATSAPP_TRX: number;
    YTD_SALE: number;
    YTD_TRX: number;
    MTD_QTY: number;
    PM_QTY: number;
}

interface EfficiencyRow {
    Location: string;
    MTD_FOOTFALL: number;
    PM_FOOTFALL: number;
    MTD_CONVERSION_PCT: number;
    PM_CONVERSION_PCT: number;
    MTD_MULTIES_PCT: number;
    PM_MULTIES_PCT: number;
    MTD_BASKET_SIZE: number;
    PM_BASKET_SIZE: number;
    MTD_ATV: number;
    PM_ATV: number;

    // Raw counters for frontend Totals (hidden columns)
    MTD_RAW_SALE?: number;
    MTD_RAW_TRX?: number;
    MTD_RAW_QTY?: number;
    MTD_RAW_MULTI_TRX?: number;
    PM_RAW_SALE?: number;
    PM_RAW_TRX?: number;
    PM_RAW_QTY?: number;
    PM_RAW_MULTI_TRX?: number;
}

interface OmniChannelRow {
    Location: string;
    MTD_SALE: number;
    MTD_TRX: number;
    MTD_UNITS: number;
    PM_SALE: number;
    PM_TRX: number;
    PM_UNITS: number;
}

interface OmniDetailsRow {
    Location: string;
    MTD_SALE: number;
    MTD_TRX: number;
    PM_SALE: number;
    PM_TRX: number;
    MTD_UNITS: number;
    MTD_ATV: number;
    MTD_BASKET_SIZE: number;
}

interface RetailOmniTotalRow {
    Location: string;
    MTD_SALE: number;
    MTD_TRX: number;
    PM_SALE: number;
    PM_TRX: number;
    YTD_SALE: number;
    YTD_TRX: number;
}

interface WhatsappBreakdownRow {
    Location: string;
    MTD_RETAIL_SALES: number;
    MTD_WHATSAPP_SALES: number;
    PM_RETAIL_SALES: number;
    PM_WHATSAPP_SALES: number;
}

type TabType = 'retail-sales' | 'retail-sales-2' | 'omni-channel' | 'omni-channel-tm-lm' | 'retail-omni' | 'whatsapp-sales' | 'analytics';

const LOGIC_HELP = {
    // Tabs
    'tab-retail': "Retail + Whatsapp: Total sales from stores, including those helped via Whatsapp.",
    'tab-efficiency': "Efficiency: How well the store is performing (Conversion, Average Bill, etc).",
    'tab-omni': "Omni Channel: Online sales performance from Shopify.",
    'tab-whatsapp': "Whatsapp Sale: Split of store sales between direct and Whatsapp-assisted.",
    'tab-omni-tm-lm': "Omni TM vs LM: Monthly growth comparison for Online sales.",
    'tab-retail-omni': "Retail + Omni: Consolidated view of both Store and Online performance.",
    'tab-analytics': "Analytics: Visual trends and charts for performance analysis.",

    // Columns
    'col-sale': "Total Sales Value: Sum of net bill amounts (Sales minus Returns).",
    'col-qty': "Total Quantity: Total number of items sold (Net of returns).",
    'col-trx': "Total Bills: Count of unique bill numbers (Sales transactions only).",
    'col-pm-sale': "Previous Month Sale: Sales value in the same period last month.",
    'col-pm-qty': "Previous Month Quantity: Total items sold in the same period last month.",
    'col-pm-trx': "Previous Month Bills: Count of unique bills in the same period last month.",
    'col-growth-sale': "Sales Growth %: ((Current Sale - Previous Sale) ÷ Previous Sale) × 100.",
    'col-growth-trx': "Bills Growth %: ((Current Bills - Previous Bills) ÷ Previous Bills) × 100.",
    'col-conv': "Conversion %: (Total Bills ÷ Total Walk-ins) × 100.",
    'col-atv': "Average Bill Value: Total Sales ÷ Total Bills.",
    'col-basket': "Average Items per Bill: Total Quantity ÷ Total Bills.",
    'col-multies': "Multi-item Bills %: (Bills with 2 or more items ÷ Total Bills) × 100.",
    'col-footfall': "Total Walk-ins: Total people who entered the store.",
    'col-ytd-sale': "Year To Date Sale: Cumulative sales from start of Financial Year (April 1st).",
    'col-ytd-trx': "Year To Date Bills: Cumulative bill count from start of Financial Year (April 1st).",
    'col-share-retail': "Retail Share %: Store sales (without Whatsapp) ÷ Total Store Sales × 100.",
    'col-share-whatsapp': "Whatsapp Share %: Whatsapp-assisted sales ÷ Total Store Sales × 100."
};

const InfoTooltip: React.FC<{ text: string, position?: 'top' | 'bottom' }> = ({ text, position = 'top' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowOffset: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const iconCenter = rect.left + rect.width / 2;
            const tooltipWidth = 256;
            const padding = 16;

            const minCenter = tooltipWidth / 2 + padding;
            const maxCenter = window.innerWidth - tooltipWidth / 2 - padding;
            const clampedCenter = Math.max(minCenter, Math.min(maxCenter, iconCenter));
            const arrowOffset = iconCenter - clampedCenter;

            setCoords({
                top: position === 'top' ? rect.top : rect.bottom,
                left: clampedCenter,
                arrowOffset: arrowOffset
            });
        }
        setIsVisible(true);
    };

    return (
        <div
            ref={triggerRef}
            className="inline-block ml-1 align-middle leading-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
        >
            <Info size={14} className="text-slate-400 hover:text-blue-500 cursor-help transition-colors" />
            {isVisible && createPortal(
                <div
                    className={`fixed z-[9999] w-64 p-3 text-xs font-medium text-white bg-slate-800 rounded-lg shadow-2xl transform -translate-x-1/2 pointer-events-none border border-slate-700 transition-opacity duration-200
                        ${position === 'top' ? '-translate-y-full' : ''}`}
                    style={{
                        top: position === 'top' ? coords.top - 8 : coords.top + 8,
                        left: coords.left
                    }}
                >
                    <div className="relative">
                        {text}
                        <div
                            className={`absolute w-2 h-2 bg-slate-800 transform rotate-45 border-slate-700
                                ${position === 'top' ? 'top-full -mt-1 border-r border-b' : 'bottom-full -mb-1 border-l border-t'}`}
                            style={{ left: `calc(50% + ${coords.arrowOffset}px)`, marginLeft: '-4px' }}
                        ></div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const MultiSelectDropdown = ({
    label,
    options,
    value,
    onChange,
    placeholder
}: {
    label: string,
    options: string[],
    value: string[],
    onChange: (val: string[]) => void,
    placeholder: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (opt: string) => {
        if (value.includes(opt)) {
            onChange(value.filter(v => v !== opt));
        } else {
            onChange([...value, opt]);
        }
    };

    const toggleAll = () => {
        if (value.length === options.length) {
            onChange([]);
        } else {
            onChange([...options]);
        }
    };

    const displayValue = () => {
        if (value.length === 0) return placeholder;
        if (value.length === options.length) return "All " + label + "s";
        if (value.length === 1) return value[0];
        return `${value.length} selected`;
    };

    return (
        <div className="relative" ref={containerRef}>
            <div
                className={`flex items-center bg-white border rounded-md px-2 sm:px-3 py-1.5 transition-all shadow-sm cursor-pointer hover:border-blue-400 select-none min-w-[100px] sm:min-w-[140px]
                    ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-[9px] sm:text-[10px] text-slate-400 mr-1 sm:mr-2 font-bold uppercase whitespace-nowrap">{label}</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate flex-1 max-w-[80px] sm:max-w-[120px]">
                    {displayValue()}
                </span>
                <ChevronDown size={12} className={`ml-1 sm:ml-2 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 pb-2 mb-2 border-b border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={value.length === options.length && options.length > 0}
                                onChange={toggleAll}
                            />
                            <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600 transition-colors">Select All</span>
                        </label>
                    </div>
                    <div className="max-h-60 overflow-y-auto px-1 custom-scrollbar">
                        {options.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer transition-colors group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={value.includes(opt)}
                                    onChange={() => toggleOption(opt)}
                                />
                                <span className={`text-sm transition-colors ${value.includes(opt) ? 'text-blue-600 font-semibold' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                    {opt}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Export Database Modal Component (Admin Only)
const ExportDatabaseModal = ({ onClose }: { onClose: () => void }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [exportType, setExportType] = useState<'full' | 'collection'>('full');
    const [selectedCollection, setSelectedCollection] = useState('sales_transactions');
    const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');

    const collections = [
        { id: 'sales_transactions', name: 'Sales Transactions', description: '~15K records' },
        { id: 'footfall', name: 'Footfall Data', description: '~6K records' },
        { id: 'users', name: 'Users', description: 'User accounts' },
        { id: 'ingestion_logs', name: 'Ingestion Logs', description: 'Sync history' }
    ];

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let url = '';
            let filename = '';
            
            if (exportType === 'full') {
                url = '/ingest/export-db';
                filename = `jacadi_dsr_full_export_${new Date().toISOString().split('T')[0]}.json`;
            } else {
                if (exportFormat === 'csv') {
                    url = `/ingest/export-csv/${selectedCollection}`;
                    filename = `${selectedCollection}_${new Date().toISOString().split('T')[0]}.csv`;
                } else {
                    url = `/ingest/export-db?collection=${selectedCollection}`;
                    filename = `${selectedCollection}_${new Date().toISOString().split('T')[0]}.json`;
                }
            }
            
            // Use fetch for download with auth
            const token = localStorage.getItem('token');
            const fullUrl = `/api${url}`;
            
            console.log('Fetching export from:', fullUrl);
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': exportType === 'full' ? 'application/json' : (exportFormat === 'csv' ? 'text/csv' : 'application/json')
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Export error response:', errorText);
                throw new Error('Export failed: ' + response.status);
            }
            
            const blob = await response.blob();
            console.log('Blob size:', blob.size);
            
            // Create object URL and trigger download
            const blobUrl = URL.createObjectURL(blob);
            
            // Create and click download link
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            
            // Append to body, click, and remove
            document.body.appendChild(a);
            a.click();
            
            // Small delay before cleanup
            await new Promise(resolve => setTimeout(resolve, 500));
            
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            
            alert(`Export complete! File "${filename}" should be in your Downloads folder.`);
            onClose();
        } catch (error: any) {
            console.error('Export error:', error);
            alert('Export failed: ' + (error.message || 'Unknown error'));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">Export Database</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        ✕
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    {/* Export Type Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Export Type</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setExportType('full')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                    exportType === 'full' 
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Full Database
                            </button>
                            <button
                                onClick={() => setExportType('collection')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                    exportType === 'collection' 
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Single Collection
                            </button>
                        </div>
                    </div>

                    {/* Collection Selection (if single collection) */}
                    {exportType === 'collection' && (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Collection</label>
                                <div className="space-y-2">
                                    {collections.map(coll => (
                                        <label 
                                            key={coll.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedCollection === coll.id 
                                                    ? 'border-amber-500 bg-amber-50' 
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="collection"
                                                checked={selectedCollection === coll.id}
                                                onChange={() => setSelectedCollection(coll.id)}
                                                className="w-4 h-4 text-amber-500"
                                            />
                                            <div>
                                                <div className="font-medium text-slate-800">{coll.name}</div>
                                                <div className="text-xs text-slate-500">{coll.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Export Format</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setExportFormat('csv')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                            exportFormat === 'csv' 
                                                ? 'bg-emerald-500 text-white' 
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        CSV (Excel)
                                    </button>
                                    <button
                                        onClick={() => setExportFormat('json')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                            exportFormat === 'json' 
                                                ? 'bg-emerald-500 text-white' 
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        JSON
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {exportType === 'full' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                            <strong>Full Database Export</strong> includes all collections (Sales, Footfall, Users, Logs) in a single JSON file.
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 font-medium transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                            isExporting 
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                    >
                        <Download size={16} />
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ currentRole }) => {
    const [showUserMgmt, setShowUserMgmt] = useState(false);
    const [showSyncHistory, setShowSyncHistory] = useState(false);
    const [showManualUpload, setShowManualUpload] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        if (!confirm('Trigger data ingestion from input_reports?')) return;
        setIsSyncing(true);
        try {
            await api.post('/ingest/run');
            alert('Ingestion started successfully! Data will refresh shortly.');
            window.location.reload();
        } catch (e: any) {
            alert('Sync failed: ' + (e.response?.data?.message || e.message));
        } finally {
            setIsSyncing(false);
        }
    };

    const handleManualUploadSuccess = () => {
        window.location.reload();
    };


    // Data State
    const [retailData, setRetailData] = useState<RetailWhatsappRow[]>([]);
    const [efficiencyData, setEfficiencyData] = useState<EfficiencyRow[]>([]);
    const [omniTmLmData, setOmniTmLmData] = useState<OmniChannelRow[]>([]);
    const [omniDetailsData, setOmniDetailsData] = useState<OmniDetailsRow[]>([]);
    const [retailOmniData, setRetailOmniData] = useState<RetailOmniTotalRow[]>([]);
    const [whatsappData, setWhatsappData] = useState<WhatsappBreakdownRow[]>([]);
    const [summary, setSummary] = useState<any>({});

    const [locations, setLocations] = useState<string[]>([]);
    const [brands, setBrands] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);

    const [selectedLocation, setSelectedLocation] = useState<string[]>([]);
    const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('retail-sales');

    // Date Range State
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [latestAvailableDate, setLatestAvailableDate] = useState<string>('');

    // Initialize Metadata (Dates + Filter Options)
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [dateRes, locRes, brandRes, catRes] = await Promise.all([
                    api.get('/dashboards/latest-date'),
                    api.get('/dashboards/default/locations'),
                    api.get('/dashboards/default/brands'),
                    api.get('/dashboards/default/categories')
                ]);

                if (dateRes.data?.date) {
                    const latest = dateRes.data.date;
                    setLatestAvailableDate(latest);
                    setEndDate(latest);

                    // Default Start Date: 1st of the latest date's month
                    const d = new Date(latest);
                    const start = new Date(d.getFullYear(), d.getMonth(), 1);
                    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
                    setStartDate(startStr);
                }

                setLocations(Array.isArray(locRes.data) ? locRes.data : []);
                setBrands(Array.isArray(brandRes.data) ? brandRes.data : []);
                setCategories(Array.isArray(catRes.data) ? catRes.data : []);

            } catch (e) {
                console.error('Failed to fetch dashboard metadata', e);
            }
        };
        fetchMetadata();
    }, []);

    // Helper: Join array for API
    const joinFilter = (val: string[]) => val.join(',');

    // Helper: Sort Data for Views
    const sortData = (data: any[]) => {
        if (!Array.isArray(data)) return [];
        return [...data].sort((a, b) => {
            const locA = (a.Location || '').toLowerCase();
            const locB = (b.Location || '').toLowerCase();
            const getRank = (loc: string) => {
                if (loc.includes('palladium')) return 1;
                if (loc.includes('moa')) return 2;
                return 100;
            };
            const rA = getRank(locA);
            const rB = getRank(locB);
            if (rA !== rB) return rA - rB;
            return locA.localeCompare(locB);
        });
    };

    // Fetch Cascading Metadata: Locations depend on Brands
    useEffect(() => {
        const fetchFilteredLocations = async () => {
            try {
                const res = await api.get('/dashboards/default/locations', {
                    params: { brand: joinFilter(selectedBrand) }
                });
                setLocations(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('Failed to fetch filtered locations', e);
            }
        };
        fetchFilteredLocations();
    }, [selectedBrand]);

    // Fetch Cascading Metadata: Categories depend on Brands and Locations
    useEffect(() => {
        const fetchFilteredCategories = async () => {
            try {
                const res = await api.get('/dashboards/default/categories', {
                    params: {
                        brand: joinFilter(selectedBrand),
                        location: joinFilter(selectedLocation)
                    }
                });
                setCategories(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('Failed to fetch filtered categories', e);
            }
        };
        fetchFilteredCategories();
    }, [selectedBrand, selectedLocation]);

    // Fetch Data on Filter Change
    useEffect(() => {
        const fetchData = async () => {
            if (!startDate || !endDate) return;
            setLoading(true);
            try {
                const params = {
                    startDate,
                    endDate,
                    location: joinFilter(selectedLocation),
                    brand: joinFilter(selectedBrand),
                    category: joinFilter(selectedCategory)
                };
                const [perfRes, efficRes, tmRes, detRes, omniRes, waRes, sumRes] = await Promise.all([
                    api.get('/dashboards/default/retail-performance', { params }),
                    api.get('/dashboards/default/retail-efficiency', { params }),
                    api.get('/dashboards/default/omni-channel-tm-lm', { params }),
                    api.get('/dashboards/default/omni-channel-details', { params }),
                    api.get('/dashboards/default/retail-omni-total', { params }),
                    api.get('/dashboards/default/whatsapp-sales-breakdown', { params }),
                    api.get('/dashboards/default/summary', { params })
                ]);

                setRetailData(sortData(perfRes.data));
                setEfficiencyData(sortData(efficRes.data));
                setOmniTmLmData(sortData(tmRes.data));
                setOmniDetailsData(sortData(detRes.data));
                setRetailOmniData(sortData(omniRes.data));
                setWhatsappData(sortData(waRes.data));
                setSummary(sumRes.data);
            } catch (e) {
                console.error('Failed to fetch dashboard data', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [startDate, endDate, selectedLocation, selectedBrand, selectedCategory]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('en-IN').format(value);
    };

    const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    };

    const getFinancialYear = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-indexed

        // If month is Jan-Mar (0, 1, 2), we are in the FY starting last year
        const fyStart = month < 3 ? year - 1 : year;
        const fyEnd = fyStart + 1;

        return `${fyStart}-${String(fyEnd).substring(2)}`;
    };

    // Helper: Sum a key across an array
    const sum = (data: any[], key: string) => data.reduce((acc, row) => acc + (row[key] || 0), 0);

    return (
        <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 font-sans">
            {/* Header */}
            <header className="flex flex-col gap-4 mb-4 sm:mb-8 border-b border-slate-200 pb-4 sm:pb-6 bg-white px-3 sm:px-6 md:px-8 py-4 sm:py-6 rounded-xl sm:rounded-2xl shadow-sm">
                {/* Logo and Title Row */}
                <div className="flex items-center gap-3 sm:gap-6">
                    <img
                        src="/jacadi-logo.png"
                        alt="Jacadi Logo"
                        className="h-12 sm:h-16 md:h-20 w-auto object-contain"
                    />
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
                            JACADI <span className="text-blue-600">DSR</span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1 sm:mt-2">
                            <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Status:</span>
                            {latestAvailableDate && (
                                <span className="flex items-center bg-blue-50 text-blue-600 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs border border-blue-100 font-bold shadow-sm">
                                    <Clock size={10} className="mr-1 sm:mr-1.5 hidden sm:inline" />
                                    {new Date(latestAvailableDate).toLocaleDateString('en-GB')}
                                </span>
                            )}
                            {latestAvailableDate && (
                                <span className="flex items-center bg-emerald-50 text-emerald-600 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs border border-emerald-100 font-bold shadow-sm">
                                    FY {getFinancialYear(latestAvailableDate)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col gap-3 w-full">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-50/50 p-2 rounded-xl border border-slate-200/60 shadow-inner w-full">
                        {/* Brand Filter - FIRST */}
                        <MultiSelectDropdown
                            label="Brand"
                            options={brands}
                            value={selectedBrand}
                            onChange={(val) => {
                                setSelectedBrand(val);
                                // Reset dependent filters when brand changes for better UX
                                setSelectedLocation([]);
                                setSelectedCategory([]);
                            }}
                            placeholder="All Brands"
                        />

                        {/* Outlet Filter */}
                        <MultiSelectDropdown
                            label="Outlet"
                            options={locations}
                            value={selectedLocation}
                            onChange={(val) => {
                                setSelectedLocation(val);
                                // Reset dependent category when location changes
                                setSelectedCategory([]);
                            }}
                            placeholder="All Outlets"
                        />

                        {/* Category Filter */}
                        <MultiSelectDropdown
                            label="Cat"
                            options={categories}
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            placeholder="All Categories"
                        />

                        <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                        {/* Date Selectors */}
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            {/* From Date */}
                            <div className="flex items-center bg-white border border-slate-300 rounded-md px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm flex-1 sm:flex-none min-w-[120px]">
                                <span className="text-[10px] text-slate-400 mr-2 font-bold uppercase">From</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent border-none text-slate-700 text-xs sm:text-sm outline-none font-medium cursor-pointer w-full"
                                />
                            </div>

                            <ArrowRight size={14} className="text-slate-400 hidden sm:block" />

                            {/* To Date */}
                            <div className="flex items-center bg-white border border-slate-300 rounded-md px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm flex-1 sm:flex-none min-w-[120px]">
                                <span className="text-[10px] text-slate-400 mr-2 font-bold uppercase">To</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent border-none text-slate-700 text-xs sm:text-sm outline-none font-medium cursor-pointer w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Admin Actions */}
                    {currentRole === 'admin' && (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                            <button
                                onClick={() => setShowUserMgmt(true)}
                                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                            >
                                <UserCog size={12} className="sm:w-[14px] sm:h-[14px]" />
                                <span className="hidden xs:inline">Users</span>
                            </button>
                            <button
                                onClick={() => setShowSyncHistory(true)}
                                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-purple-600 transition-all"
                            >
                                <History size={12} className="sm:w-[14px] sm:h-[14px]" />
                                <span className="hidden xs:inline">History</span>
                            </button>
                            <button
                                onClick={() => setShowManualUpload(true)}
                                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-green-600 transition-all"
                            >
                                <Upload size={12} className="sm:w-[14px] sm:h-[14px]" />
                                <span className="hidden xs:inline">Upload</span>
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm transition-all ${isSyncing
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                                    }`}
                            >
                                <RefreshCcw size={12} className={`sm:w-[14px] sm:h-[14px] ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                            </button>
                            <button
                                onClick={() => setShowExportModal(true)}
                                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm bg-amber-500 text-white hover:bg-amber-600 transition-all"
                            >
                                <Download size={12} className="sm:w-[14px] sm:h-[14px]" />
                                <span className="hidden sm:inline">Export DB</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* User Management Modal */}
            {showUserMgmt && <UserManagement onClose={() => setShowUserMgmt(false)} />}

            {/* Sync History Modal */}
            {showSyncHistory && <SyncHistory onClose={() => setShowSyncHistory(false)} />}

            {/* Manual Upload Modal */}
            {showManualUpload && (
                <ManualUpload 
                    onClose={() => setShowManualUpload(false)} 
                    onSuccess={handleManualUploadSuccess}
                />
            )}

            {/* Export Database Modal */}
            {showExportModal && (
                <ExportDatabaseModal onClose={() => setShowExportModal(false)} />
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="text-slate-500 font-medium">Loading data for {startDate} to {endDate}...</div>
                </div>
            ) : (
                <>
                    {/* Tab Navigation */}
                    <div className="mb-4 sm:mb-8 overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                        <nav className="flex space-x-1 sm:space-x-2 bg-white p-1 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm w-fit min-w-max">
                            {[
                                { id: 'retail-sales', label: 'Retail Sales', mobileLabel: 'Retail', help: LOGIC_HELP['tab-retail'] },
                                { id: 'retail-sales-2', label: 'Conversions', mobileLabel: 'Conv.', help: LOGIC_HELP['tab-efficiency'] },
                                { id: 'whatsapp-sales', label: 'Whatsapp Sale', mobileLabel: 'WA', help: LOGIC_HELP['tab-whatsapp'] },
                                { id: 'omni-channel-tm-lm', label: 'Omni TM/LM', mobileLabel: 'Omni', help: LOGIC_HELP['tab-omni-tm-lm'] },
                                { id: 'omni-channel', label: 'Omni Channel', mobileLabel: 'Omni+', help: LOGIC_HELP['tab-omni'] },
                                { id: 'retail-omni', label: 'Retail+Omni', mobileLabel: 'R+O', help: LOGIC_HELP['tab-retail-omni'] },
                                { id: 'analytics', label: 'Analytics', mobileLabel: 'Charts', help: LOGIC_HELP['tab-analytics'] }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center gap-1 ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                >
                                    <span className="sm:hidden">{tab.mobileLabel}</span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.help && <span className="hidden sm:inline"><InfoTooltip text={tab.help} position="bottom" /></span>}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-8">
                        <KPICard
                            title={<span>Total Revenue <InfoTooltip text={LOGIC_HELP['col-sale']} /></span>}
                            value={formatCurrency(summary.total_revenue || 0)}
                            subtext="Selected Range"
                            icon={<DollarSign size={24} className="text-emerald-600" />}
                            pmGrowth={calculateGrowth(summary.total_revenue || 0, summary.pm_revenue || 0)}
                        />
                        <KPICard
                            title={<span>Transactions <InfoTooltip text={LOGIC_HELP['col-trx']} /></span>}
                            value={formatNumber(summary.total_transactions || 0)}
                            subtext="Selected Range"
                            icon={<ShoppingCart size={24} className="text-blue-600" />}
                            pmGrowth={calculateGrowth(summary.total_transactions || 0, summary.pm_transactions || 0)}
                        />
                        <KPICard
                            title={<span>Avg Transaction <InfoTooltip text={LOGIC_HELP['col-atv']} /></span>}
                            value={formatCurrency(summary.avg_transaction_value || 0)}
                            subtext="ATV"
                            icon={<TrendingUp size={24} className="text-purple-600" />}
                            pmGrowth={calculateGrowth(summary.avg_transaction_value || 0, summary.pm_atv || 0)}
                        />
                        <KPICard
                            title={<span>Active Stores <InfoTooltip text="Total stores that recorded sales in the selected period." /></span>}
                            value={summary.total_locations || 0}
                            subtext="Reporting Locations"
                            icon={<Users size={24} className="text-orange-600" />}
                        />
                    </div>

                    {/* Content Area */}
                    <div className="bg-white rounded-lg sm:rounded-2xl shadow-sm border border-slate-200 overflow-visible">

                        {/* Analytics Tab */}
                        {activeTab === 'analytics' && (
                            <div className="p-2 sm:p-6">
                                <Analytics startDate={startDate} endDate={endDate} />
                            </div>
                        )}

                        {/* 1. Retail + Whatsapp Sales */}
                        {activeTab === 'retail-sales' && (() => {
                            const totalMtdRetail = sum(retailData, 'MTD_RETAIL_SALE');
                            const totalMtdWhatsapp = sum(retailData, 'MTD_WHATSAPP_SALE');
                            const totalMtdQty = sum(retailData, 'MTD_QTY');
                            const totalMtdTrx = sum(retailData, 'MTD_RETAIL_TRX') + sum(retailData, 'MTD_WHATSAPP_TRX');

                            const totalPm = sum(retailData, 'PM_RETAIL_SALE') + sum(retailData, 'PM_WHATSAPP_SALE');
                            const totalPmQty = sum(retailData, 'PM_QTY');
                            const totalPmTrx = sum(retailData, 'PM_RETAIL_TRX') + sum(retailData, 'PM_WHATSAPP_TRX');

                            const totalYtdSale = sum(retailData, 'YTD_SALE');
                            const totalYtdTrx = sum(retailData, 'YTD_TRX');

                            const saleGrowthTotal = calculateGrowth(totalMtdRetail + totalMtdWhatsapp, totalPm);
                            const trxGrowthTotal = calculateGrowth(totalMtdTrx, totalPmTrx);

                            // Export function for Retail + Whatsapp Sales
                            const handleExportRetailWhatsapp = () => {
                                const exportData = retailData.map(row => ({
                                    Location: row.Location,
                                    'MTD Sale': row.MTD_RETAIL_SALE + row.MTD_WHATSAPP_SALE,
                                    'MTD Qty': row.MTD_QTY,
                                    'MTD TRX': row.MTD_RETAIL_TRX + row.MTD_WHATSAPP_TRX,
                                    'PM Sale': row.PM_RETAIL_SALE + row.PM_WHATSAPP_SALE,
                                    'PM Qty': row.PM_QTY,
                                    'PM TRX': row.PM_RETAIL_TRX + row.PM_WHATSAPP_TRX,
                                    'Sale Growth %': calculateGrowth(row.MTD_RETAIL_SALE + row.MTD_WHATSAPP_SALE, row.PM_RETAIL_SALE + row.PM_WHATSAPP_SALE).toFixed(1),
                                    'TRX Growth %': calculateGrowth(row.MTD_RETAIL_TRX + row.MTD_WHATSAPP_TRX, row.PM_RETAIL_TRX + row.PM_WHATSAPP_TRX).toFixed(1),
                                    'YTD Sale': row.YTD_SALE,
                                    'YTD TRX': row.YTD_TRX
                                }));
                                exportToCSV(exportData, 'Retail_Whatsapp_Sales');
                            };

                            return (
                                <TableContainer title="Retail + Whatsapp Sales" subtitle="Sales Performance Breakdown" onExport={handleExportRetailWhatsapp}>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Location</th>
                                                <th className="px-6 py-4 text-right">MTD SALE <InfoTooltip text={LOGIC_HELP['col-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD QTY <InfoTooltip text={LOGIC_HELP['col-qty']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD TRX <InfoTooltip text={LOGIC_HELP['col-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM SALE <InfoTooltip text={LOGIC_HELP['col-pm-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM QTY <InfoTooltip text={LOGIC_HELP['col-pm-qty']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM TRX <InfoTooltip text={LOGIC_HELP['col-pm-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">SALE % <InfoTooltip text={LOGIC_HELP['col-growth-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">TRX % <InfoTooltip text={LOGIC_HELP['col-growth-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400 whitespace-nowrap">YTD SALE <InfoTooltip text={LOGIC_HELP['col-ytd-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400 whitespace-nowrap">YTD TRX <InfoTooltip text={LOGIC_HELP['col-ytd-trx']} position="bottom" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {retailData.filter(row => {
                                                const totalActivity = Math.abs(row.MTD_RETAIL_SALE) + Math.abs(row.MTD_WHATSAPP_SALE) + Math.abs(row.PM_RETAIL_SALE) + Math.abs(row.PM_WHATSAPP_SALE) + Math.abs(row.YTD_SALE);
                                                return totalActivity > 1;
                                            }).map((row, idx) => {
                                                const totalMtdSale = row.MTD_RETAIL_SALE + row.MTD_WHATSAPP_SALE;
                                                const totalPmSale = row.PM_RETAIL_SALE + row.PM_WHATSAPP_SALE;
                                                const totalMtdTrx = row.MTD_RETAIL_TRX + row.MTD_WHATSAPP_TRX;
                                                const totalPmTrx = (row.PM_RETAIL_TRX || 0) + (row.PM_WHATSAPP_TRX || 0);

                                                const saleGrowth = calculateGrowth(totalMtdSale, totalPmSale);
                                                const trxGrowth = calculateGrowth(totalMtdTrx, totalPmTrx);

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-slate-800">{row.Location}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{formatCurrency(totalMtdSale)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-emerald-600 font-bold">{formatNumber(row.MTD_QTY)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-blue-600 font-bold">{formatNumber(totalMtdTrx)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatCurrency(totalPmSale)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400 italic">{formatNumber(row.PM_QTY)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400 italic">{formatNumber(totalPmTrx)}</td>
                                                        <td className={`px-6 py-4 text-right font-bold ${saleGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {saleGrowth >= 0 ? '↑' : '↓'} {Math.abs(saleGrowth).toFixed(1)}%
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-bold ${trxGrowth >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                                            {Math.abs(trxGrowth).toFixed(1)}%
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatCurrency(row.YTD_SALE)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.YTD_TRX)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Total Row */}
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-4 text-slate-900">TOTAL</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{formatCurrency(totalMtdRetail + totalMtdWhatsapp)}</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{formatNumber(totalMtdQty)}</td>
                                                <td className="px-6 py-4 text-right text-blue-700">{formatNumber(totalMtdTrx)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalPm)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmQty)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmTrx)}</td>
                                                <td className={`px-6 py-4 text-right ${saleGrowthTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {Math.abs(saleGrowthTotal).toFixed(1)}%
                                                </td>
                                                <td className={`px-6 py-4 text-right ${trxGrowthTotal >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                    {Math.abs(trxGrowthTotal).toFixed(1)}%
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalYtdSale)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalYtdTrx)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </TableContainer>
                            );
                        })()}

                        {/* 2. Retail + Whatsapp Sales 2 (Efficiency) */}
                        {activeTab === 'retail-sales-2' && (() => {
                            // Use RAW data for weighted averages
                            const totalFootfall = sum(efficiencyData, 'MTD_FOOTFALL');
                            const totalPmFootfall = sum(efficiencyData, 'PM_FOOTFALL');

                            const totalRawSale = sum(efficiencyData, 'MTD_RAW_SALE' as any);
                            const totalRawTrx = sum(efficiencyData, 'MTD_RAW_TRX' as any);
                            const totalRawQty = sum(efficiencyData, 'MTD_RAW_QTY' as any);
                            const totalRawMulti = sum(efficiencyData, 'MTD_RAW_MULTI_TRX' as any);

                            const totalPmRawSale = sum(efficiencyData, 'PM_RAW_SALE' as any);
                            const totalPmRawTrx = sum(efficiencyData, 'PM_RAW_TRX' as any);
                            const totalPmRawQty = sum(efficiencyData, 'PM_RAW_QTY' as any);
                            const totalPmRawMulti = sum(efficiencyData, 'PM_RAW_MULTI_TRX' as any);

                            // Derived Totals
                            const totalConv = totalFootfall > 0 ? (totalRawTrx / totalFootfall) * 100 : 0;
                            const totalPmConv = totalPmFootfall > 0 ? (totalPmRawTrx / totalPmFootfall) * 100 : 0;

                            const totalAtv = totalRawTrx > 0 ? totalRawSale / totalRawTrx : 0;
                            const totalPmAtv = totalPmRawTrx > 0 ? totalPmRawSale / totalPmRawTrx : 0;

                            const totalBasket = totalRawTrx > 0 ? totalRawQty / totalRawTrx : 0;
                            const totalPmBasket = totalPmRawTrx > 0 ? totalPmRawQty / totalPmRawTrx : 0;

                            const totalMulties = totalRawTrx > 0 ? (totalRawMulti / totalRawTrx) * 100 : 0;
                            const totalPmMulties = totalPmRawTrx > 0 ? (totalPmRawMulti / totalPmRawTrx) * 100 : 0;

                            // Export function for Conversions
                            const handleExportConversions = () => {
                                const exportData = efficiencyData.map(row => ({
                                    Location: row.Location,
                                    'MTD Footfall': row.MTD_FOOTFALL,
                                    'PM Footfall': row.PM_FOOTFALL,
                                    'MTD Conversion %': row.MTD_CONVERSION_PCT?.toFixed(1),
                                    'PM Conversion %': row.PM_CONVERSION_PCT?.toFixed(1),
                                    'MTD ATV': row.MTD_ATV?.toFixed(0),
                                    'PM ATV': row.PM_ATV?.toFixed(0),
                                    'MTD Basket Size': row.MTD_BASKET_SIZE?.toFixed(2),
                                    'PM Basket Size': row.PM_BASKET_SIZE?.toFixed(2),
                                    'MTD Multies %': row.MTD_MULTIES_PCT?.toFixed(1),
                                    'PM Multies %': row.PM_MULTIES_PCT?.toFixed(1)
                                }));
                                exportToCSV(exportData, 'Conversions_Efficiency');
                            };

                            return (
                                <TableContainer title="Retail + Whatsapp Sales (Conversions)" subtitle="Efficiency Metrics" onExport={handleExportConversions}>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Location</th>
                                                <th className="px-6 py-4 text-right">MTD CONVERSION % <InfoTooltip text={LOGIC_HELP['col-conv']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM CONVERSION % <InfoTooltip text="Conversion % in the previous month's period." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD ATV <InfoTooltip text={LOGIC_HELP['col-atv']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM ATV <InfoTooltip text="Average Bill Value in the previous month's period." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD BASKET SIZE <InfoTooltip text={LOGIC_HELP['col-basket']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM BASKET SIZE <InfoTooltip text="Average Items per Bill in the previous month's period." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD MULTIES <InfoTooltip text={LOGIC_HELP['col-multies']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM MULTIES <InfoTooltip text="Multi-item Bills % in the previous month's period." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD FOOTFALL <InfoTooltip text={LOGIC_HELP['col-footfall']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM FOOTFALL <InfoTooltip text="Total walk-ins in the previous month's period." position="bottom" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {efficiencyData.filter(row => (row.MTD_FOOTFALL + row.PM_FOOTFALL + Math.abs(row.MTD_RAW_SALE || 0)) > 0.1).map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-semibold text-slate-800">{row.Location}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{row.MTD_CONVERSION_PCT.toFixed(1)}%</td>
                                                    <td className="px-6 py-4 text-right text-slate-400 italic">{row.PM_CONVERSION_PCT.toFixed(1)}%</td>
                                                    <td className="px-6 py-4 text-right font-mono text-blue-600">{formatNumber(row.MTD_ATV)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.PM_ATV)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-orange-600">{row.MTD_BASKET_SIZE.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400">{row.PM_BASKET_SIZE.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-purple-600">{row.MTD_MULTIES_PCT.toFixed(1)}%</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400">{row.PM_MULTIES_PCT.toFixed(1)}%</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-700">{formatNumber(row.MTD_FOOTFALL)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.PM_FOOTFALL)}</td>
                                                </tr>
                                            ))}
                                            {/* Total Row */}
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-4 text-slate-900">TOTAL</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{totalConv.toFixed(1)}%</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{totalPmConv.toFixed(1)}%</td>
                                                <td className="px-6 py-4 text-right text-blue-700">{formatNumber(totalAtv)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmAtv)}</td>
                                                <td className="px-6 py-4 text-right text-orange-700">{totalBasket.toFixed(2)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{totalPmBasket.toFixed(2)}</td>
                                                <td className="px-6 py-4 text-right text-purple-700">{totalMulties.toFixed(1)}%</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{totalPmMulties.toFixed(1)}%</td>
                                                <td className="px-6 py-4 text-right text-slate-700">{formatNumber(totalFootfall)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmFootfall)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </TableContainer>
                            );
                        })()}

                        {/* 3. Omni Channel (Details) */}
                        {activeTab === 'omni-channel' && (() => {
                            const totalSale = sum(omniDetailsData, 'MTD_SALE');
                            const totalTrx = sum(omniDetailsData, 'MTD_TRX');
                            const totalPmSale = sum(omniDetailsData, 'PM_SALE');
                            const totalPmTrx = sum(omniDetailsData, 'PM_TRX');
                            const totalUnits = sum(omniDetailsData, 'MTD_UNITS');

                            const totalAtv = totalTrx > 0 ? totalSale / totalTrx : 0;
                            const totalBasket = totalTrx > 0 ? totalUnits / totalTrx : 0;

                            // Export function for Omni Channel
                            const handleExportOmniChannel = () => {
                                const exportData = omniDetailsData.map(row => ({
                                    Location: row.Location,
                                    'MTD Sale': row.MTD_SALE,
                                    'MTD TRX': row.MTD_TRX,
                                    'PM Sale': row.PM_SALE,
                                    'PM TRX': row.PM_TRX,
                                    'Sale Growth %': calculateGrowth(row.MTD_SALE, row.PM_SALE).toFixed(1),
                                    'TRX Growth %': calculateGrowth(row.MTD_TRX, row.PM_TRX).toFixed(1),
                                    'MTD ATV': row.MTD_TRX > 0 ? (row.MTD_SALE / row.MTD_TRX).toFixed(0) : 0,
                                    'MTD Basket': row.MTD_TRX > 0 ? (row.MTD_UNITS / row.MTD_TRX).toFixed(2) : 0
                                }));
                                exportToCSV(exportData, 'Omni_Channel');
                            };

                            return (
                                <TableContainer title="Omni Channel" subtitle="Detailed E-Commerce Breakdown" onExport={handleExportOmniChannel}>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Location</th>
                                                <th className="px-6 py-4 text-right">MTD SALE <InfoTooltip text={LOGIC_HELP['col-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD TRX <InfoTooltip text={LOGIC_HELP['col-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM SALE <InfoTooltip text={LOGIC_HELP['col-pm-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM TRX <InfoTooltip text={LOGIC_HELP['col-pm-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD UNITS <InfoTooltip text={LOGIC_HELP['col-qty']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD ATV <InfoTooltip text={LOGIC_HELP['col-atv']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD BASKET <InfoTooltip text={LOGIC_HELP['col-basket']} position="bottom" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {omniDetailsData.filter(row => (Math.abs(row.MTD_SALE) + Math.abs(row.PM_SALE) + row.MTD_TRX) > 0.1).map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-semibold text-slate-800">{row.Location}</td>
                                                    <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600">{formatCurrency(row.MTD_SALE)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-blue-600">{formatNumber(row.MTD_TRX)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400">{formatCurrency(row.PM_SALE)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.PM_TRX)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-700">{formatNumber(row.MTD_UNITS)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(row.MTD_ATV)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-orange-600">{row.MTD_BASKET_SIZE.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            {/* Total Row */}
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-4 text-slate-900">TOTAL</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{formatCurrency(totalSale)}</td>
                                                <td className="px-6 py-4 text-right text-blue-700">{formatNumber(totalTrx)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalPmSale)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmTrx)}</td>
                                                <td className="px-6 py-4 text-right text-slate-700">{formatNumber(totalUnits)}</td>
                                                <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(totalAtv)}</td>
                                                <td className="px-6 py-4 text-right text-orange-700">{totalBasket.toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </TableContainer>
                            );
                        })()}

                        {/* 4. Omni Channel TM vs LM */}
                        {activeTab === 'omni-channel-tm-lm' && (() => {
                            const totalMtd = sum(omniTmLmData, 'MTD_SALE');
                            const totalPm = sum(omniTmLmData, 'PM_SALE');
                            const totalMtdTrx = sum(omniTmLmData, 'MTD_TRX');
                            const totalPmTrx = sum(omniTmLmData, 'PM_TRX');
                            const totalUnits = sum(omniTmLmData, 'MTD_UNITS');

                            const saleGrowth = calculateGrowth(totalMtd, totalPm);
                            const trxGrowth = calculateGrowth(totalMtdTrx, totalPmTrx);

                            // Export function for Omni TM vs LM
                            const handleExportOmniTmLm = () => {
                                const exportData = omniTmLmData.map(row => ({
                                    Location: row.Location,
                                    'MTD Sale': row.MTD_SALE,
                                    'PM Sale': row.PM_SALE,
                                    'Sale Growth %': calculateGrowth(row.MTD_SALE, row.PM_SALE).toFixed(1),
                                    'MTD TRX': row.MTD_TRX,
                                    'PM TRX': row.PM_TRX,
                                    'TRX Growth %': calculateGrowth(row.MTD_TRX, row.PM_TRX).toFixed(1)
                                }));
                                exportToCSV(exportData, 'Omni_TM_vs_LM');
                            };

                            return (
                                <TableContainer title="Omni Channel TM vs LM" subtitle="Growth Analysis" onExport={handleExportOmniTmLm}>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Location</th>
                                                <th className="px-6 py-4 text-right">MTD SALE <InfoTooltip text={LOGIC_HELP['col-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM SALE <InfoTooltip text={LOGIC_HELP['col-pm-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">SALE % <InfoTooltip text={LOGIC_HELP['col-growth-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD TRX <InfoTooltip text={LOGIC_HELP['col-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM TRX <InfoTooltip text={LOGIC_HELP['col-pm-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">TRX % <InfoTooltip text={LOGIC_HELP['col-growth-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD UNITS <InfoTooltip text={LOGIC_HELP['col-qty']} position="bottom" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {omniTmLmData.filter(row => (Math.abs(row.MTD_SALE) + Math.abs(row.PM_SALE)) > 0.1).map((row, idx) => {
                                                const g = calculateGrowth(row.MTD_SALE, row.PM_SALE);
                                                const tG = calculateGrowth(row.MTD_TRX, row.PM_TRX);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-slate-800">{row.Location}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600">{formatCurrency(row.MTD_SALE)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatCurrency(row.PM_SALE)}</td>
                                                        <td className={`px-6 py-4 text-right font-bold ${g >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {g >= 0 ? '↑' : '↓'} {Math.abs(g).toFixed(1)}%
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-blue-600">{formatNumber(row.MTD_TRX)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.PM_TRX)}</td>
                                                        <td className={`px-6 py-4 text-right font-bold ${tG >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                                            {Math.abs(tG).toFixed(1)}%
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-700">{formatNumber(row.MTD_UNITS)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Total Row */}
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-4 text-slate-900">TOTAL</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{formatCurrency(totalMtd)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalPm)}</td>
                                                <td className={`px-6 py-4 text-right ${saleGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {saleGrowth >= 0 ? '↑' : '↓'} {Math.abs(saleGrowth).toFixed(1)}%
                                                </td>
                                                <td className="px-6 py-4 text-right text-blue-700">{formatNumber(totalMtdTrx)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmTrx)}</td>
                                                <td className={`px-6 py-4 text-right ${trxGrowth >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                    {Math.abs(trxGrowth).toFixed(1)}%
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-700">{formatNumber(totalUnits)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </TableContainer>
                            );
                        })()}

                        {/* 5. Retail + Omni (Total) */}
                        {activeTab === 'retail-omni' && (() => {
                            const totalMtd = sum(retailOmniData, 'MTD_SALE');
                            const totalTrx = sum(retailOmniData, 'MTD_TRX');
                            const totalPm = sum(retailOmniData, 'PM_SALE');
                            const totalPmTrx = sum(retailOmniData, 'PM_TRX');
                            const totalYtd = sum(retailOmniData, 'YTD_SALE');
                            const totalYtdTrx = sum(retailOmniData, 'YTD_TRX');

                            const saleGrowth = calculateGrowth(totalMtd, totalPm);
                            const trxGrowth = calculateGrowth(totalTrx, totalPmTrx);

                            // Export function for Retail + Omni
                            const handleExportRetailOmni = () => {
                                const exportData = retailOmniData.map(row => ({
                                    Location: row.Location,
                                    'MTD Sale': row.MTD_SALE,
                                    'MTD TRX': row.MTD_TRX,
                                    'PM Sale': row.PM_SALE,
                                    'PM TRX': row.PM_TRX,
                                    'Sale Growth %': calculateGrowth(row.MTD_SALE, row.PM_SALE).toFixed(1),
                                    'TRX Growth %': calculateGrowth(row.MTD_TRX, row.PM_TRX).toFixed(1),
                                    'YTD Sale': row.YTD_SALE,
                                    'YTD TRX': row.YTD_TRX
                                }));
                                exportToCSV(exportData, 'Retail_Plus_Omni');
                            };

                            return (
                                <TableContainer title="Retail + Omni" subtitle="Total Brand Performance" onExport={handleExportRetailOmni}>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Location</th>
                                                <th className="px-6 py-4 text-right">MTD SALE <InfoTooltip text={LOGIC_HELP['col-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">MTD TRX <InfoTooltip text={LOGIC_HELP['col-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM SALE <InfoTooltip text={LOGIC_HELP['col-pm-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">PM TRX <InfoTooltip text={LOGIC_HELP['col-pm-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">SALE % <InfoTooltip text={LOGIC_HELP['col-growth-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">TRX % <InfoTooltip text={LOGIC_HELP['col-growth-trx']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400">YTD SALE <InfoTooltip text={LOGIC_HELP['col-ytd-sale']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-400 whitespace-nowrap">YTD TRX <InfoTooltip text={LOGIC_HELP['col-ytd-trx']} position="bottom" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {retailOmniData.filter(row => (Math.abs(row.MTD_SALE) + Math.abs(row.PM_SALE) + Math.abs(row.YTD_SALE)) > 0.1).map((row, idx) => {
                                                const g = calculateGrowth(row.MTD_SALE, row.PM_SALE);
                                                const tG = calculateGrowth(row.MTD_TRX, row.PM_TRX);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-slate-800">{row.Location}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600">{formatCurrency(row.MTD_SALE)}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-medium text-blue-600">{formatNumber(row.MTD_TRX)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatCurrency(row.PM_SALE)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.PM_TRX)}</td>
                                                        <td className={`px-6 py-4 text-right font-bold ${g >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {Math.abs(g).toFixed(0)}%
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-bold ${tG >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                                            {Math.abs(tG).toFixed(0)}%
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatCurrency(row.YTD_SALE)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-400">{formatNumber(row.YTD_TRX)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Total Row */}
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-4 text-slate-900">TOTAL</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{formatCurrency(totalMtd)}</td>
                                                <td className="px-6 py-4 text-right text-blue-700">{formatNumber(totalTrx)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalPm)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalPmTrx)}</td>
                                                <td className={`px-6 py-4 text-right ${saleGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {saleGrowth >= 0 ? '↑' : '↓'} {Math.abs(saleGrowth).toFixed(0)}%
                                                </td>
                                                <td className={`px-6 py-4 text-right ${trxGrowth >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                    {Math.abs(trxGrowth).toFixed(0)}%
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalYtd)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatNumber(totalYtdTrx)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </TableContainer>
                            );
                        })()}


                        {/* 6. Whatsapp Sales (Breakdown) */}
                        {activeTab === 'whatsapp-sales' && (() => {
                            const totalRetail = sum(whatsappData, 'MTD_RETAIL_SALES');
                            const totalWhatsapp = sum(whatsappData, 'MTD_WHATSAPP_SALES');
                            const totalPmRetail = sum(whatsappData, 'PM_RETAIL_SALES');
                            const totalPmWhatsapp = sum(whatsappData, 'PM_WHATSAPP_SALES');
                            const total = totalRetail + totalWhatsapp;
                            const shareWhatsapp = total > 0 ? (totalWhatsapp / total) * 100 : 0;
                            const shareRetail = total > 0 ? (totalRetail / total) * 100 : 0;

                            // Export function for Whatsapp Sales
                            const handleExportWhatsapp = () => {
                                const exportData = whatsappData.map(row => ({
                                    Location: row.Location,
                                    'MTD Retail Sales': row.MTD_RETAIL_SALES,
                                    'MTD Whatsapp Sales': row.MTD_WHATSAPP_SALES,
                                    'MTD Whatsapp Share %': (row.MTD_RETAIL_SALES + row.MTD_WHATSAPP_SALES) > 0 
                                        ? ((row.MTD_WHATSAPP_SALES / (row.MTD_RETAIL_SALES + row.MTD_WHATSAPP_SALES)) * 100).toFixed(1)
                                        : 0,
                                    'PM Retail Sales': row.PM_RETAIL_SALES,
                                    'PM Whatsapp Sales': row.PM_WHATSAPP_SALES
                                }));
                                exportToCSV(exportData, 'Whatsapp_Sales');
                            };

                            return (
                                <TableContainer title="Whatsapp Sales" subtitle="Direct Retail vs Whatsapp Share" onExport={handleExportWhatsapp}>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Location</th>
                                                <th className="px-6 py-4 text-right">Retail MTD SALES <InfoTooltip text="Store sales excluding online and Whatsapp." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right">Whatsapp MTD SALES <InfoTooltip text="Store sales helped via Whatsapp." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-500">PM Retail SALES <InfoTooltip text="Store Retail sales in the same period last month." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-500">PM Whatsapp SALES <InfoTooltip text="Store Whatsapp sales in the same period last month." position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-500">RETAIL SALE % <InfoTooltip text={LOGIC_HELP['col-share-retail']} position="bottom" /></th>
                                                <th className="px-6 py-4 text-right text-slate-500">WHATSAPP SALE % <InfoTooltip text={LOGIC_HELP['col-share-whatsapp']} position="bottom" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {whatsappData.filter(row => (Math.abs(row.MTD_RETAIL_SALES) + Math.abs(row.MTD_WHATSAPP_SALES)) > 0.1).map((row, idx) => {
                                                const totalRow = row.MTD_RETAIL_SALES + row.MTD_WHATSAPP_SALES;
                                                const shareRowW = totalRow > 0 ? (row.MTD_WHATSAPP_SALES / totalRow) * 100 : 0;
                                                const shareRowR = totalRow > 0 ? (row.MTD_RETAIL_SALES / totalRow) * 100 : 0;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-slate-800">{row.Location}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600">{formatCurrency(row.MTD_RETAIL_SALES)}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-medium text-blue-600">{formatCurrency(row.MTD_WHATSAPP_SALES)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-500">{formatCurrency(row.PM_RETAIL_SALES)}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-500">{formatCurrency(row.PM_WHATSAPP_SALES)}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{shareRowR.toFixed(1)}%</td>
                                                        <td className="px-6 py-4 text-right font-bold text-blue-600">{shareRowW.toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Total Row */}
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-4 text-slate-900">TOTAL</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{formatCurrency(totalRetail)}</td>
                                                <td className="px-6 py-4 text-right text-blue-700">{formatCurrency(totalWhatsapp)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalPmRetail)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(totalPmWhatsapp)}</td>
                                                <td className="px-6 py-4 text-right text-emerald-700">{shareRetail.toFixed(1)}%</td>
                                                <td className="px-6 py-4 text-right text-blue-700">{shareWhatsapp.toFixed(1)}%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </TableContainer>
                            );
                        })()}
                    </div>
                </>
            )}
        </div>
    );
};

// UI Components
const KPICard = ({ title, value, subtext, icon, pmGrowth }: {
    title: React.ReactNode,
    value: string | number,
    subtext: string,
    icon: React.ReactNode,
    pmGrowth?: number | null
}) => (
    <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group overflow-visible">
        <div className="flex justify-between items-start mb-2 sm:mb-4">
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 leading-tight">{title}</h3>
            <div className="p-1.5 sm:p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors shrink-0">
                <div className="w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">{icon}</div>
            </div>
        </div>
        <div className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 mb-1 truncate">{value}</div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-2 sm:mt-3">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{subtext}</span>
            {pmGrowth !== undefined && pmGrowth !== null && (
                <div className={`flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold ml-auto ${pmGrowth >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                    {pmGrowth >= 0 ? <ArrowUpRight size={8} className="sm:w-[10px] sm:h-[10px]" /> : <ArrowDownRight size={8} className="sm:w-[10px] sm:h-[10px]" />}
                    {Math.abs(pmGrowth).toFixed(1)}%
                </div>
            )}
        </div>
    </div>
);

const TableContainer = ({ title, subtitle, children, onExport }: { title: string, subtitle: string, children: React.ReactNode, onExport?: () => void }) => (
    <div>
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white">
            <div>
                <h2 className="text-sm sm:text-lg font-bold text-slate-800">{title}</h2>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
                {onExport && <ExportButton onClick={onExport} />}
                <div className="text-slate-300">
                    <BarChart2 size={16} className="sm:w-5 sm:h-5" />
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            {children}
        </div>
    </div>
);

export default Dashboard;
