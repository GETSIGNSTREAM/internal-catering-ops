"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/supabase-auth-provider';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Calendar, Truck, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTimePST } from '@/utils/timezone';

interface Order {
  id: number;
  orderNumber?: string;
  customerName: string;
  organization?: string;
  pickupTime?: string;
  deliveryTime?: string;
  status: string;
  deliveryMode?: string;
  totalAmount?: number;
  orderSource?: string;
  store?: { id: number; name: string };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';

  // Re-fetch orders when currentDate or viewMode changes
  useEffect(() => {
    fetchOrders();
  }, [currentDate, viewMode]);

  const toggleDayCollapse = (dateStr: string) => {
    setCollapsedDays(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  // Helper: get YYYY-MM-DD in LA timezone for a given Date
  const toLADate = (d: Date) => {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Calculate the visible date range based on view mode
      let from: Date, to: Date;
      if (viewMode === 'week') {
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        startOfWeek.setDate(startOfWeek.getDate() + diff);
        startOfWeek.setHours(0, 0, 0, 0);
        from = startOfWeek;
        to = new Date(startOfWeek);
        to.setDate(to.getDate() + 7);
      } else {
        from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        // Pad a week on either side for calendar overflow days
        from.setDate(from.getDate() - 7);
        to.setDate(to.getDate() + 7);
      }
      const params = new URLSearchParams({
        limit: '500',
        fulfillmentDateFrom: from.toISOString(),
        fulfillmentDateTo: to.toISOString(),
      });
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Get the LA-timezone date string for an order's fulfillment time
  const getOrderLADate = (order: Order): string | null => {
    const dateStr = order.deliveryMode === 'delivery' ? order.deliveryTime : order.pickupTime;
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    let startPadding = firstDay.getDay() - 1;
    if (startPadding < 0) startPadding = 6;

    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const getOrdersForDate = (date: Date) => {
    const targetDate = toLADate(date);
    return orders.filter(order => {
      return getOrderLADate(order) === targetDate;
    });
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    return toLADate(date) === toLADate(new Date());
  };

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500',
    confirmed: 'bg-indigo-500',
    prep: 'bg-yellow-500',
    ready: 'bg-green-500',
    delivered: 'bg-gray-500',
    cancelled: 'bg-red-500'
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    return formatTimePST(dateStr);
  };

  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);

  const dayNames = locale === 'es-MX'
    ? ['Lun', 'Mar', 'Mi\u00e9', 'Jue', 'Vie', 'S\u00e1b', 'Dom']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-chicken-primary" size={24} />
            <h1 className="text-xl font-bold text-white">{t('calendar.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1 rounded-lg text-sm bg-dark-600 text-gray-300 hover:bg-dark-500"
            >
              {t('calendar.today')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <button
            onClick={navigatePrev}
            className="p-2 text-gray-400 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-white">
            {currentDate.toLocaleDateString(locale, {
              month: 'long',
              year: 'numeric',
              ...(viewMode === 'week' ? { day: 'numeric' } : {})
            })}
          </h2>
          <button
            onClick={navigateNext}
            className="p-2 text-gray-400 hover:text-white"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'week' ? 'bg-chicken-primary text-dark-900' : 'bg-dark-600 text-gray-300'
            }`}
          >
            {t('calendar.week')}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'month' ? 'bg-chicken-primary text-dark-900' : 'bg-dark-600 text-gray-300'
            }`}
          >
            {t('calendar.month')}
          </button>
        </div>
      </header>

      <main className="px-2 py-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">{t('calendar.loadingCalendar')}</div>
        ) : viewMode === 'week' ? (
          <div className="space-y-2">
            {weekDays.map((day) => {
              const dayOrders = getOrdersForDate(day);
              const dateStr = day.toISOString();
              const isCollapsed = collapsedDays[dateStr];

              return (
                <div
                  key={dateStr}
                  className={`bg-dark-700 rounded-xl p-3 ${isToday(day) ? 'ring-2 ring-chicken-primary' : ''}`}
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleDayCollapse(dateStr)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                        &#9660;
                      </span>
                      <span className={`text-sm font-medium ${isToday(day) ? 'text-chicken-primary' : 'text-gray-400'}`}>
                        {day.toLocaleDateString(locale, { weekday: 'short' })}
                      </span>
                      <span className={`text-lg font-bold ${isToday(day) ? 'text-chicken-primary' : 'text-white'}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    {dayOrders.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {t('orders.native')}: <span className="text-blue-400">${(dayOrders.filter(o => o.orderSource === 'eatwildbird.com').reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 100).toFixed(0)}</span>
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {t('orders.total')}: <span className="text-chicken-primary">${(dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 100).toFixed(0)}</span>
                        </span>
                        <span className="text-xs bg-dark-600 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">
                          {dayOrders.length} {dayOrders.length !== 1 ? t('orders.orders_count') : t('orders.order')}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="mt-3">
                      {dayOrders.length === 0 ? (
                        <p className="text-sm text-gray-500">{t('calendar.noOrders')}</p>
                      ) : (
                        <div className="space-y-2">
                          {dayOrders.map(order => (
                            <div
                              key={order.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/orders/${order.id}`);
                              }}
                              className="bg-dark-600 rounded-lg p-2 cursor-pointer hover:bg-dark-500 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${statusColors[order.status] || 'bg-gray-500'}`} />
                                <span className="text-sm font-medium text-white truncate">
                                  {order.customerName}
                                </span>
                                <span className="text-xs text-gray-400 ml-auto">
                                  {formatTime(order.deliveryMode === 'delivery' ? order.deliveryTime : order.pickupTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>{order.deliveryMode === 'delivery' ? <Truck size={12} /> : <Store size={12} />}</span>
                                {order.orderNumber && <span>#{order.orderNumber}</span>}
                                {order.totalAmount && (
                                  <span className="text-green-400">${(order.totalAmount / 100).toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map(({ date, isCurrentMonth }, index) => {
                const dayOrders = getOrdersForDate(date);
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] rounded-lg p-1 ${
                      isCurrentMonth ? 'bg-dark-700' : 'bg-dark-800'
                    } ${isToday(date) ? 'ring-2 ring-chicken-primary' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      isToday(date) ? 'text-chicken-primary' : isCurrentMonth ? 'text-white' : 'text-gray-600'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayOrders.slice(0, 3).map(order => (
                        <div
                          key={order.id}
                          onClick={() => router.push(`/orders/${order.id}`)}
                          className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${statusColors[order.status] || 'bg-gray-500'} text-white`}
                        >
                          {order.customerName.split(' ')[0]}
                        </div>
                      ))}
                      {dayOrders.length > 3 && (
                        <div className="text-xs text-gray-400 px-1">
                          +{dayOrders.length - 3} {t('common.more')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
