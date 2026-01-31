import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { AreaChartCard, BarChartCard } from '../components/ChartCard';
import { Calendar } from '../components/ui/calendar';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  CalendarDays,
  RefreshCw,
  Store,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Performance() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [storeData, setStoreData] = useState([]);
  const [channelData, setChannelData] = useState([]);
  const [comparison, setComparison] = useState(null);
  
  // Filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [storeLocation, setStoreLocation] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      if (endDate) params.append('end_date', format(endDate, 'yyyy-MM-dd'));
      if (storeLocation && storeLocation !== 'all') params.append('store_location', storeLocation);

      const [chartRes, storeRes, channelRes, compRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/chart-data?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/by-store?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/by-channel?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/comparison`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setChartData(chartRes.data);
      setStoreData(storeRes.data);
      setChannelData(channelRes.data);
      setComparison(compRes.data);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, storeLocation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderChange = (value) => {
    if (value > 0) {
      return (
        <span className="flex items-center gap-1 text-emerald-400">
          <TrendingUp className="w-3 h-3" />
          +{value.toFixed(1)}%
        </span>
      );
    } else if (value < 0) {
      return (
        <span className="flex items-center gap-1 text-red-400">
          <TrendingDown className="w-3 h-3" />
          {value.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-slate-400">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="performance-page">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl lg:text-3xl font-bold text-white">
            Performance Analysis
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Detailed metrics and comparisons
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="btn-secondary h-9 text-sm gap-2" data-testid="perf-date-filter">
                <CalendarDays className="w-4 h-4" />
                {startDate && endDate 
                  ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
                  : 'Date Range'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10" align="end">
              <div className="p-3 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-2">Start Date</p>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">End Date</p>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    className="rounded-lg"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={storeLocation} onValueChange={setStoreLocation}>
            <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10 text-sm" data-testid="perf-store-filter">
              <Store className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Stores</SelectItem>
              <SelectItem value="Jacadi Palladium">Jacadi Palladium</SelectItem>
              <SelectItem value="Jacadi MOA">Jacadi MOA</SelectItem>
              <SelectItem value="Shopify Webstore">Shopify Webstore</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchData}
            className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5"
            data-testid="perf-refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4">
        <AreaChartCard
          title="Daily Revenue & Units"
          data={chartData}
          dataKey="revenue"
          secondaryDataKey="quantity"
          xAxisKey="date"
          loading={loading}
        />
      </div>

      {/* Store Performance Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Store Performance</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-slate-400">Store</TableHead>
              <TableHead className="text-slate-400 text-right">Revenue</TableHead>
              <TableHead className="text-slate-400 text-right">Units</TableHead>
              <TableHead className="text-slate-400 text-right">Transactions</TableHead>
              <TableHead className="text-slate-400 text-right">ATV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i} className="border-white/5">
                  <TableCell><div className="h-4 w-32 bg-slate-800/50 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : storeData.length === 0 ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              storeData.map((store) => (
                <TableRow key={store.store} className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-medium text-white">{store.store}</TableCell>
                  <TableCell className="text-right text-white">₱{store.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">{store.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">{store.transactions.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">
                    ₱{store.transactions > 0 ? (store.revenue / store.transactions).toFixed(0) : 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Channel Performance Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Channel Performance</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-slate-400">Channel</TableHead>
              <TableHead className="text-slate-400 text-right">Revenue</TableHead>
              <TableHead className="text-slate-400 text-right">Units</TableHead>
              <TableHead className="text-slate-400 text-right">Transactions</TableHead>
              <TableHead className="text-slate-400 text-right">ATV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i} className="border-white/5">
                  <TableCell><div className="h-4 w-24 bg-slate-800/50 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : channelData.length === 0 ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              channelData.map((channel) => (
                <TableRow key={channel.channel} className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-medium text-white">{channel.channel}</TableCell>
                  <TableCell className="text-right text-white">₱{channel.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">{channel.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">{channel.transactions.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">
                    ₱{channel.transactions > 0 ? (channel.revenue / channel.transactions).toFixed(0) : 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Period Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">MTD Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Revenue</span>
              <div className="text-right">
                <p className="text-white font-medium">₱{(comparison?.mtd?.revenue || 0).toLocaleString()}</p>
                <p className="text-xs">{renderChange(comparison?.mtd_change?.revenue || 0)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Units</span>
              <div className="text-right">
                <p className="text-white font-medium">{(comparison?.mtd?.quantity || 0).toLocaleString()}</p>
                <p className="text-xs">{renderChange(comparison?.mtd_change?.quantity || 0)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Transactions</span>
              <div className="text-right">
                <p className="text-white font-medium">{(comparison?.mtd?.transactions || 0).toLocaleString()}</p>
                <p className="text-xs">{renderChange(comparison?.mtd_change?.transactions || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">YTD Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Revenue</span>
              <div className="text-right">
                <p className="text-white font-medium">₱{(comparison?.ytd?.revenue || 0).toLocaleString()}</p>
                <p className="text-xs">{renderChange(comparison?.ytd_change?.revenue || 0)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Units</span>
              <div className="text-right">
                <p className="text-white font-medium">{(comparison?.ytd?.quantity || 0).toLocaleString()}</p>
                <p className="text-xs">{renderChange(comparison?.ytd_change?.quantity || 0)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Transactions</span>
              <div className="text-right">
                <p className="text-white font-medium">{(comparison?.ytd?.transactions || 0).toLocaleString()}</p>
                <p className="text-xs">{renderChange(comparison?.ytd_change?.transactions || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
