import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon: Icon, 
  prefix = '', 
  suffix = '',
  loading = false,
  className = '',
  delay = 0
}) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  
  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return (val / 1000000).toFixed(2) + 'M';
      } else if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div 
      className={`metric-card group ${className}`}
      style={{ animation: `fade-in 0.5s ease-out ${delay}ms forwards` }}
    >
      {/* Glow Effect */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#D70075]/0 via-[#D70075]/0 to-[#38BDF8]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
            {title}
          </span>
          {Icon && (
            <div className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-[#D70075] transition-colors">
              <Icon className="w-4 h-4" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Value */}
        {loading ? (
          <div className="h-10 w-32 bg-slate-800/50 rounded animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-lg text-slate-500 font-medium">{prefix}</span>}
            <span className="font-outfit text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {formatValue(value)}
            </span>
            {suffix && <span className="text-lg text-slate-500 font-medium">{suffix}</span>}
          </div>
        )}

        {/* Change Indicator */}
        {change !== undefined && (
          <div className="flex items-center gap-2 mt-3">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isPositive 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : isNegative 
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-slate-500/20 text-slate-400'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : isNegative ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span>{Math.abs(change).toFixed(1)}%</span>
            </div>
            {changeLabel && (
              <span className="text-xs text-slate-500">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
