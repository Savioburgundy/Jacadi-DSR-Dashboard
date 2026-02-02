// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Info, Calendar } from 'lucide-react';
import api from '../../services/api';

// Format number with Indian comma style (₹1,23,456)
const formatIndianNumber = (num: number): string => {
    if (num === null || num === undefined) return '0';
    const numStr = Math.round(num).toString();
    let result = '';
    let count = 0;
    for (let i = numStr.length - 1; i >= 0; i--) {
        count++;
        result = numStr[i] + result;
        if (count === 3 && i !== 0) {
            result = ',' + result;
            count = 0;
        } else if (count > 3 && count % 2 === 1 && i !== 0) {
            result = ',' + result;
        }
    }
    return result;
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

// Info Card Component
const InfoCard = ({ title, dateRange, children }: { title: string, dateRange: string, children: React.ReactNode }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
                <Calendar size={12} />
                <span>{dateRange}</span>
            </div>
        </div>
        {children}
    </div>
);

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
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard Analytics</h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <Info size={14} className="text-blue-500" />
                    <span>Data Period: <strong className="text-blue-600">{dateRangeText}</strong></span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm">Total Sales</h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">₹{formatIndianNumber(summary?.total_sales || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{dateRangeText}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm">Transactions</h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">{formatIndianNumber(summary?.total_trx || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{dateRangeText}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm">ATV</h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">₹{formatIndianNumber(summary?.atv || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Avg Transaction Value</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 text-xs sm:text-sm">UPT</h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">{summary?.upt || 0}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Units Per Transaction</p>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Sales Trend - Line Chart */}
                <InfoCard title="Sales Trend" dateRange={dateRangeText}>
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
                <InfoCard title="Channel Mix" dateRange={dateRangeText}>
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
                <InfoCard title="Store Performance" dateRange={dateRangeText}>
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
                <InfoCard title="Hourly Traffic Pattern" dateRange={dateRangeText}>
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
