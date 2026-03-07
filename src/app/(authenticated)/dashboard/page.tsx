"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/supabase-auth-provider';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Calendar, Clock, ChefHat,
  Plus, Store, Users, BarChart3, Trophy, Camera, Sheet, Loader2
} from 'lucide-react';
import { NotificationSettings } from '@/components/ui/NotificationSettings';
import LanguageToggle from '@/components/ui/LanguageToggle';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/ui/PageTransition';

interface Stats {
  todayCount: number;
  weekCount: number;
  onTimePercent: number;
  avgPrepTime: number;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [savingPhotoSetting, setSavingPhotoSetting] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/settings/requirePhotoForDelivery').then(r => r.json()).catch(() => ({ value: null }))
    ]).then(([statsData, settingData]) => {
      setStats(statsData);
      setRequirePhoto(settingData.value === 'true');
      setLoading(false);
    });
  }, []);

  const toggleRequirePhoto = async () => {
    const newValue = !requirePhoto;
    setSavingPhotoSetting(true);
    try {
      await fetch('/api/settings/requirePhotoForDelivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(newValue) })
      });
      setRequirePhoto(newValue);
    } catch (err) {
      console.error('Failed to save setting:', err);
    } finally {
      setSavingPhotoSetting(false);
    }
  };

  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/backfill-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: '2026-02-01', endDate: '2026-12-31' })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Synced ${data.success} orders${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
      } else {
        setSyncResult(data.error || 'Sync failed');
      }
    } catch (err) {
      setSyncResult('Sync failed - check connection');
    } finally {
      setSyncingSheets(false);
    }
  };

  const statCards = [
    { label: t('dashboard.ordersToday'), value: stats?.todayCount || 0, icon: ClipboardList, color: 'bg-blue-500' },
    { label: t('dashboard.thisWeek'), value: stats?.weekCount || 0, icon: Calendar, color: 'bg-purple-500' },
    { label: t('dashboard.onTimePercent'), value: `${stats?.onTimePercent || 0}%`, icon: Clock, color: 'bg-green-500' },
    { label: t('dashboard.avgPrepTime'), value: `${stats?.avgPrepTime || 0}m`, icon: ChefHat, color: 'bg-orange-500' }
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-chicken-primary" size={24} />
            <h1 className="text-xl font-bold text-white">{t('dashboard.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button onClick={() => signOut()} className="text-gray-400 hover:text-white text-sm">
              {t('common.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <PageTransition>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="card-premium p-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <motion.div
                    className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3 shadow-lg`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: index * 0.1 + 0.2 }}
                  >
                    <stat.icon size={20} className="text-white" />
                  </motion.div>
                  <motion.p
                    className="text-2xl font-bold text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <section className="card-premium p-4">
              <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.quickActions')}</h2>
              <div className="space-y-3">
                <motion.button
                  onClick={() => router.push('/orders')}
                  className="w-full bg-dark-600 hover:bg-dark-500 text-white py-3 px-4 rounded-xl flex items-center gap-3 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={20} className="text-chicken-primary" />
                  <span>{t('dashboard.createNewOrder')}</span>
                </motion.button>
                {user?.role === 'admin' && (
                  <>
                    <motion.button
                      onClick={() => router.push('/stores')}
                      className="w-full bg-dark-600 hover:bg-dark-500 text-white py-3 px-4 rounded-xl flex items-center gap-3 transition-colors"
                      whileTap={{ scale: 0.98 }}
                    >
                      <Store size={20} className="text-chicken-primary" />
                      <span>{t('dashboard.manageStores')}</span>
                    </motion.button>
                    <motion.button
                      onClick={() => router.push('/team')}
                      className="w-full bg-dark-600 hover:bg-dark-500 text-white py-3 px-4 rounded-xl flex items-center gap-3 transition-colors"
                      whileTap={{ scale: 0.98 }}
                    >
                      <Users size={20} className="text-chicken-primary" />
                      <span>{t('dashboard.viewTeam')}</span>
                    </motion.button>
                  </>
                )}
              </div>
            </section>

            <section className="card-premium p-4 mt-4">
              <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.reportsAnalytics')}</h2>
              <div className="space-y-3">
                <motion.button
                  onClick={() => router.push('/reports')}
                  className="w-full bg-dark-600 hover:bg-dark-500 text-white py-3 px-4 rounded-xl flex items-center gap-3 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <BarChart3 size={20} className="text-chicken-primary" />
                  <span>{t('dashboard.salesReports')}</span>
                </motion.button>
                {user?.role === 'admin' && (
                  <motion.button
                    onClick={() => router.push('/store-performance')}
                    className="w-full bg-dark-600 hover:bg-dark-500 text-white py-3 px-4 rounded-xl flex items-center gap-3 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    <Trophy size={20} className="text-chicken-primary" />
                    <span>{t('dashboard.storePerformance')}</span>
                  </motion.button>
                )}
              </div>
            </section>

            <section className="card-premium p-4 mt-4">
              <h2 className="text-lg font-semibold text-white mb-4">{t('common.settings')}</h2>
              <div className="space-y-4">
                <LanguageToggle />
                <NotificationSettings />
                {user?.role === 'admin' && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Camera size={20} className="text-chicken-primary" />
                      <div>
                        <p className="text-sm text-white font-medium">{t('settings.requirePhoto')}</p>
                        <p className="text-xs text-gray-400">{t('settings.requirePhotoDesc')}</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleRequirePhoto}
                      disabled={savingPhotoSetting}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        requirePhoto ? 'bg-chicken-primary' : 'bg-dark-500'
                      } ${savingPhotoSetting ? 'opacity-50' : ''}`}
                    >
                      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                        requirePhoto ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                )}
                {user?.role === 'admin' && (
                  <div className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sheet size={20} className="text-chicken-primary" />
                        <div>
                          <p className="text-sm text-white font-medium">Sync Orders to Google Sheets</p>
                          <p className="text-xs text-gray-400">Re-sync all Feb 2026+ orders to spreadsheet</p>
                        </div>
                      </div>
                      <button
                        onClick={handleSyncSheets}
                        disabled={syncingSheets}
                        className="px-3 py-1.5 bg-chicken-primary text-dark-900 text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {syncingSheets ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          'Sync'
                        )}
                      </button>
                    </div>
                    {syncResult && (
                      <p className={`text-xs mt-2 ml-8 ${syncResult.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                        {syncResult}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </PageTransition>
        )}
      </main>
    </div>
  );
}
