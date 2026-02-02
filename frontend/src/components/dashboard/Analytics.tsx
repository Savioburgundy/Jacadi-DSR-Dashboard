// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Info, Calendar, HelpCircle } from 'lucide-react';
import api from '../../services/api';

// Format number with Indian comma style (₹51,36,765)
const formatIndianNumber = (num: number): string => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    
    const isNegative = num < 0;
    const absNum = Math.abs(Math.round(num));
    const numStr = absNum.toString();
    
    if (numStr.length <= 3) {
        return isNegative ? `-${numStr}` : numStr;
    }
    
    // Indian format: last 3 digits, then groups of 2
    const lastThree = numStr.slice(-3);
    const remaining = numStr.slice(0, -3);
    
    // Add commas every 2 digits for the remaining part
    let formatted = '';
    for (let i = remaining.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 2 === 0) {
            formatted = ',' + formatted;
        }
        formatted = remaining[i] + formatted;
    }
    
    const result = formatted ? `${formatted},${lastThree}` : lastThree;
    return isNegative ? `-${result}` : result;
};

// Info Tooltip Component
const InfoTooltip = ({ text }: { text: string }) => {
    const [show, setShow] = useState(false);
    
    return (
        <span className="relative inline-flex items-center ml-1">
            <HelpCircle 
                size={12} 
                className="text-slate-400 hover:text-blue-500 cursor-help transition-colors"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            />
            {show && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 sm:w-56 p-2 bg-slate-800 text-white text-[10px] sm:text-xs rounded-lg shadow-lg">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </span>
    );
};

// Custom Tooltip for charts
const CustomTooltip = ({ active, payload, label, prefix = '₹' }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                <p className="font-semibold text-slate-700">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} style={{ color: entry.color }} className="text-sm">
                        {entry.name}: {prefix}{formatIndianNumber(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Info Card Component with tooltip
const InfoCard = ({ title, dateRange, tooltip, children }: { title: string, dateRange: string, tooltip?: string, children: React.ReactNode }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                {title}
                {tooltip && <InfoTooltip text={tooltip} />}
            </h3>
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
                <Calendar size={12} />
                <span>{dateRange}</span>
            </div>
        </div>
        {children}
    </div>
);

// KPI definitions for tooltips
const KPI_INFO = {
    totalSales: "Total Net Revenue: Sum of all invoice values in the selected period (Net of Returns).",
    transactions: "Transaction Count: Number of unique invoices where transaction type is 'IV' or 'IR' and item is classified as 'Sales'. Excludes returns (SR).",
    atv: "Average Transaction Value: Total Net Revenue ÷ Total Transactions. Indicates average spend per customer visit.",
    upt: "Units Per Transaction: Total Units Sold ÷ Total Transactions. Indicates average items per basket.",
    salesTrend: "Shows daily net sales revenue trend for the selected period. Helps identify peak and slow days.",
    channelMix: "Breakdown of sales by channel (Brick and Mortar vs E-Commerce). Shows contribution percentage.",
    storePerformance: "Comparison of net sales across different store locations for the selected period.",
    hourlyTraffic: "Distribution of transactions across hours of the day. Helps identify peak shopping hours."
};

interface AnalyticsProps {
    startDate?: string;
    endDate?: string;
}

const Analytics: React.FC<AnalyticsProps> = ({ startDate, endDate }) => {
    const [trends, setTrends] = useState<any[]>([]);
    const [hourly, setHourly] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [channels, setChannels] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataDateRange, setDataDateRange] = useState({ from: '', to: '' });

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            const queryString = params.toString() ? `?${params.toString()}` : '';

            const [trendsRes, hourlyRes, sumRes, chanRes, storeRes] = await Promise.all([
                api.get(`/analytics/trends${queryString}`),
                api.get(`/analytics/hourly${queryString}`),
                api.get(`/analytics/summary${queryString}`),
                api.get(`/analytics/channel-split${queryString}`),
                api.get(`/analytics/store-performance${queryString}`)
            ]);
            
            setTrends(trendsRes.data);
            setHourly(hourlyRes.data);
            setSummary(sumRes.data);
            setChannels(chanRes.data);
            setStores(storeRes.data);

            // Set date range for display
            if (startDate && endDate) {
                setDataDateRange({
                    from: new Date(startDate).toLocaleDateString('en-GB'),
                    to: new Date(endDate).toLocaleDateString('en-GB')
                });
            } else if (trendsRes.data.length > 0) {
                const dates = trendsRes.data.map((d: any) => d.date).sort();
                setDataDateRange({
                    from: new Date(dates[0]).toLocaleDateString('en-GB'),
                    to: new Date(dates[dates.length - 1]).toLocaleDateString('en-GB')
                });
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatYAxis = (value: number) => {
        if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
        if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
        if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
        return `₹${value}`;
    };

    const dateRangeText = dataDateRange.from && dataDateRange.to 
        ? `${dataDateRange.from} - ${dataDateRange.to}` 
        : 'All Time';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-slate-500">Loading Analytics...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center">
                    Dashboard Analytics
                    <InfoTooltip text="Visual analytics showing sales trends, channel distribution, store performance, and traffic patterns for the selected date range." />
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <Info size={14} className="text-blue-500" />
                    <span>Data Period: <strong className="text-blue-600">{dateRangeText}</strong></span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm flex items-center">
                        Total Sales
                        <InfoTooltip text={KPI_INFO.totalSales} />
                    </h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">₹{formatIndianNumber(summary?.total_sales || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{dateRangeText}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm flex items-center">
                        Transactions
                        <InfoTooltip text={KPI_INFO.transactions} />
                    </h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">{formatIndianNumber(summary?.total_trx || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{dateRangeText}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm flex items-center">
                        ATV
                        <InfoTooltip text={KPI_INFO.atv} />
                    </h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">₹{formatIndianNumber(summary?.atv || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Avg Transaction Value</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm flex items-center">
                        UPT
                        <InfoTooltip text={KPI_INFO.upt} />
                    </h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">{summary?.upt || 0}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Units Per Transaction</p>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Sales Trend - Line Chart */}
                <InfoCard title="Sales Trend" dateRange={dateRangeText} tooltip={KPI_INFO.salesTrend}>
                    <div className="h-56 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis 
                                    dataKey="date" 
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return `${date.getDate()}/${date.getMonth() + 1}`;
                                    }}
                                />
                                <YAxis 
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={formatYAxis}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="sales" 
                                    stroke="#3B82F6" 
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                    name="Sales"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </InfoCard>

                {/* Channel Mix - Pie Chart */}
                <InfoCard title="Channel Mix" dateRange={dateRangeText} tooltip={KPI_INFO.channelMix}>
                    <div className="h-56 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={channels}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={70}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {channels.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => [`₹${formatIndianNumber(value)}`, 'Sales']}
                                />
                                <Legend 
                                    formatter={(value) => <span className="text-xs">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </InfoCard>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Store Performance - Bar Chart */}
                <InfoCard title="Store Performance" dateRange={dateRangeText} tooltip={KPI_INFO.storePerformance}>
                    <div className="h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stores} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis 
                                    type="number" 
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={formatYAxis}
                                />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={80} 
                                    tick={{ fontSize: 10 }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="sales" fill="#10B981" name="Sales" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </InfoCard>

                {/* Hourly Traffic - Bar Chart */}
                <InfoCard title="Hourly Traffic Pattern" dateRange={dateRangeText} tooltip={KPI_INFO.hourlyTraffic}>
                    <div className="h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourly}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis 
                                    dataKey="hour" 
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(value) => `${value}:00`}
                                />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                                    <p className="font-semibold text-slate-700">{label}:00 hrs</p>
                                                    <p className="text-sm text-amber-600">
                                                        Transactions: {formatIndianNumber(payload[0].value)}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="trx_count" fill="#F59E0B" name="Transactions" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </InfoCard>
            </div>
        </div>
    );
};

export default Analytics;
