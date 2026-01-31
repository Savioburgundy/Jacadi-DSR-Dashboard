import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { MetricCard } from '../components/MetricCard';
import { AreaChartCard, BarChartCard, PieChartCard } from '../components/ChartCard';
import { Calendar } from '../components/ui/calendar';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  DollarSign,
  Package,
  Receipt,
  BarChart3,
  ShoppingBasket,
  Percent,
  Users,
  CalendarDays,
  RefreshCw,
  Store,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Dashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [storeData, setStoreData] = useState([]);
  const [channelData, setChannelData] = useState([]);
  
  // Filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [storeLocation, setStoreLocation] = useState('all');
  const [salesChannel, setSalesChannel] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      if (endDate) params.append('end_date', format(endDate, 'yyyy-MM-dd'));
      if (storeLocation && storeLocation !== 'all') params.append('store_location', storeLocation);
      if (salesChannel && salesChannel !== 'all') params.append('sales_channel', salesChannel);

      const [metricsRes, compRes, chartRes, storeRes, channelRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/metrics?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/comparison`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/chart-data?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/by-store?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/dashboard/by-channel?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setMetrics(metricsRes.data);
      setComparison(compRes.data);
      setChartData(chartRes.data);
      setStoreData(storeRes.data.map(s => ({ name: s.store, value: s.revenue })));
      setChannelData(channelRes.data.map(c => ({ name: c.channel, value: c.revenue })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, storeLocation, salesChannel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setStoreLocation('all');
    setSalesChannel('all');
  };

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl lg:text-3xl font-bold text-white">
            Executive Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time sales performance overview
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="btn-secondary h-9 text-sm gap-2" data-testid="date-filter">
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

          {/* Store Filter */}
          <Select value={storeLocation} onValueChange={setStoreLocation}>
            <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10 text-sm" data-testid="store-filter">
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

          {/* Channel Filter */}
          <Select value={salesChannel} onValueChange={setSalesChannel}>
            <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10 text-sm" data-testid="channel-filter">
              <Globe className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="Store">Store</SelectItem>
              <SelectItem value="E-com">E-com</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchData}
            className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5"
            data-testid="refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Clear Filters */}
          {(startDate || endDate || storeLocation !== 'all' || salesChannel !== 'all') && (
            <Button 
              variant="ghost" 
              onClick={clearFilters}
              className="h-9 text-sm text-slate-400 hover:text-white"
              data-testid="clear-filters-btn"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <MetricCard
          title="Net Revenue"
          value={metrics?.net_revenue || 0}
          prefix="₱"
          change={comparison?.mtd_change?.revenue}
          changeLabel="vs last month"
          icon={DollarSign}
          loading={loading}
          delay={100}
          data-testid="metric-revenue"
        />
        <MetricCard
          title="Net Units"
          value={metrics?.net_quantity || 0}
          change={comparison?.mtd_change?.quantity}
          changeLabel="vs last month"
          icon={Package}
          loading={loading}
          delay={150}
          data-testid="metric-units"
        />
        <MetricCard
          title="Transactions"
          value={metrics?.transaction_count || 0}
          change={comparison?.mtd_change?.transactions}
          changeLabel="vs last month"
          icon={Receipt}
          loading={loading}
          delay={200}
          data-testid="metric-trx"
        />
        <MetricCard
          title="ATV"
          value={metrics?.atv || 0}
          prefix="₱"
          icon={BarChart3}
          loading={loading}
          delay={250}
          data-testid="metric-atv"
        />
        <MetricCard
          title="Basket Size"
          value={metrics?.basket_size?.toFixed(1) || 0}
          icon={ShoppingBasket}
          loading={loading}
          delay={300}
          data-testid="metric-basket"
        />
        <MetricCard
          title="Multies %"
          value={metrics?.multies_percentage?.toFixed(1) || 0}
          suffix="%"
          icon={Percent}
          loading={loading}
          delay={350}
          data-testid="metric-multies"
        />
        <MetricCard
          title="Conversion"
          value={metrics?.conversion_percentage?.toFixed(1) || 0}
          suffix="%"
          icon={Users}
          loading={loading}
          delay={400}
          data-testid="metric-conversion"
        />
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">MTD vs Last Month</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Revenue</p>
              <p className="text-xl font-outfit font-bold text-white">
                ₱{(comparison?.mtd?.revenue || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${comparison?.mtd_change?.revenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {comparison?.mtd_change?.revenue >= 0 ? '+' : ''}{comparison?.mtd_change?.revenue?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Units</p>
              <p className="text-xl font-outfit font-bold text-white">
                {(comparison?.mtd?.quantity || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${comparison?.mtd_change?.quantity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {comparison?.mtd_change?.quantity >= 0 ? '+' : ''}{comparison?.mtd_change?.quantity?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Transactions</p>
              <p className="text-xl font-outfit font-bold text-white">
                {(comparison?.mtd?.transactions || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${comparison?.mtd_change?.transactions >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {comparison?.mtd_change?.transactions >= 0 ? '+' : ''}{comparison?.mtd_change?.transactions?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">YTD vs Last Year</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Revenue</p>
              <p className="text-xl font-outfit font-bold text-white">
                ₱{(comparison?.ytd?.revenue || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${comparison?.ytd_change?.revenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {comparison?.ytd_change?.revenue >= 0 ? '+' : ''}{comparison?.ytd_change?.revenue?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Units</p>
              <p className="text-xl font-outfit font-bold text-white">
                {(comparison?.ytd?.quantity || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${comparison?.ytd_change?.quantity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {comparison?.ytd_change?.quantity >= 0 ? '+' : ''}{comparison?.ytd_change?.quantity?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Transactions</p>
              <p className="text-xl font-outfit font-bold text-white">
                {(comparison?.ytd?.transactions || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${comparison?.ytd_change?.transactions >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {comparison?.ytd_change?.transactions >= 0 ? '+' : ''}{comparison?.ytd_change?.transactions?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AreaChartCard
          title="Revenue Trend"
          data={chartData}
          dataKey="revenue"
          xAxisKey="date"
          loading={loading}
          className="lg:col-span-2"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieChartCard
          title="Revenue by Store"
          data={storeData}
          loading={loading}
        />
        <PieChartCard
          title="Revenue by Channel"
          data={channelData}
          loading={loading}
        />
      </div>
    </div>
  );
}
