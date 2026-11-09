'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, List, PlusCircle, BarChart2, Target, Menu, X, LogOut, User, UserCircle, Calculator } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (pathname === '/login') return null;

  const navItems = [
    { href: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/transactions', label: t('nav.transactions'), icon: List },
    { href: '/add', label: t('nav.add'), icon: PlusCircle },
    { href: '/reports', label: t('nav.reports'), icon: BarChart2 },
    { href: '/budgets', label: t('nav.budgets'), icon: Target },
    { href: '/profile', label: t('nav.profile'), icon: UserCircle },
    { href: '/afford', label: t('nav.afford'), icon: Calculator },
  ];

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const LangToggle = () => (
    <button
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
      title={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'}
    >
      <span className="text-base leading-none">{lang === 'en' ? '🇸🇦' : '🇬🇧'}</span>
      <span>{lang === 'en' ? 'العربية' : 'English'}</span>
    </button>
  );

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="font-bold text-slate-900 text-lg">Budget Tracker</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right side: lang toggle + user + logout */}
          <div className="hidden md:flex items-center gap-3">
            <LangToggle />
            {!loading && user && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-indigo-600" />
                  </div>
                  <span className="text-sm text-slate-600 max-w-[180px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <LogOut size={15} />
                  {signingOut ? t('nav.signingOut') : t('nav.signOut')}
                </button>
              </>
            )}
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}

          <div className="mt-2 pt-3 border-t border-slate-100">
            <div className="px-4 py-2">
              <LangToggle />
            </div>
          </div>

          {!loading && user && (
            <div className="pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500">
                <User size={14} />
                <span className="truncate">{user.email}</span>
              </div>
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                disabled={signingOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                {t('nav.signOut')}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
