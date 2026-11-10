'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  PhContract,
  PhInstallment,
  PhPayment,
  PhHoursEntry,
  PhExpensePeriod,
  PhDeveloperRate,
  KWD,
  currentYM,
} from '@/lib/ph-types';
import { ChevronDown, ChevronRight, AlertTriangle, BarChart2, Info } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function firstDay(ym: string) { return `${ym}-01`; }

function lastDay(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function monthsSpanned(start: string, end: string): number {
  const [sy, sm] = start.slice(0, 7).split('-').map(Number);
  const [ey, em] = end.slice(0, 7).split('-').map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

function dateToYM(d: string) { return d.slice(0, 7); }

function isInMonth(date: string, ym: string) { return date.startsWith(ym); }

function rangeCoversMonth(start: string, end: string, ym: string): boolean {
  const fd = firstDay(ym);
  const ld = lastDay(ym);
  return start <= ld && end >= fd;
}

// ── Types for computed rows ────────────────────────────────────────────────

interface ProjectRow {
  projectId: string;
  projectName: string;
  contractId: string;
  contractType: 'maintenance' | 'implementation';
  totalValue: number;
  contractStart: string;
  contractEnd: string;
  installments: (PhInstallment & { ph_payments: PhPayment[] })[];
  scheduleValid: boolean;
  scheduleDiff: number;
  planningIncome: number;
  fixedExpenseShare: number;
  laborBudget: number;
  hoursLogged: number;
  actualCost: number;
  hoursCap: number | null;
  hoursRemaining: number | null;
  overrunKWD: number;
  installmentsDue: number;
  paymentsCollected: number;
  rateAvailable: boolean;
}

export default function MonthlyDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYM());
  const [contracts, setContracts] = useState<(PhContract & { ph_installments: (PhInstallment & { ph_payments: PhPayment[] })[] })[]>([]);
  const [hours, setHours] = useState<PhHoursEntry[]>([]);
  const [expensePeriods, setExpensePeriods] = useState<(PhExpensePeriod & { ph_expense_types: { name: string } })[]>([]);
  const [planningRate, setPlanningRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = async (ym: string) => {
    if (!user) return;
    setLoading(true);

    const fd = firstDay(ym);
    const ld = lastDay(ym);

    const [contractsRes, hoursRes, expenseRes, rateRes] = await Promise.all([
      supabase
        .from('ph_contracts')
        .select('*, ph_projects(id, name), ph_clients(name), ph_installments(*, ph_payments(*))')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lte('start_date', ld)
        .gte('end_date', fd),
      supabase
        .from('ph_hours')
        .select('*, ph_projects(name)')
        .eq('user_id', user.id)
        .gte('work_date', fd)
        .lte('work_date', ld),
      supabase
        .from('ph_expense_periods')
        .select('*, ph_expense_types(name)')
        .eq('user_id', user.id)
        .lte('start_month', ym)
        .or(`end_month.is.null,end_month.gte.${ym}`),
      supabase
        .from('ph_developer_rates')
        .select('*')
        .eq('user_id', user.id)
        .lte('effective_date', ld)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setContracts((contractsRes.data ?? []) as typeof contracts);
    setHours((hoursRes.data ?? []) as PhHoursEntry[]);
    setExpensePeriods((expenseRes.data ?? []) as typeof expensePeriods);
    setPlanningRate((rateRes.data as PhDeveloperRate | null)?.hourly_rate ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchData(selectedMonth);
  }, [user, authLoading, selectedMonth]);

  // ── Computed data ──────────────────────────────────────────────────────

  const totalFixedExpenses = useMemo(() =>
    expensePeriods.reduce((s, ep) => s + Number(ep.amount), 0),
    [expensePeriods]
  );

  const projectRows = useMemo((): ProjectRow[] => {
    if (contracts.length === 0) return [];

    const activeProjectCount = contracts.length;
    const fixedShare = activeProjectCount > 0 ? totalFixedExpenses / activeProjectCount : 0;

    const fd = firstDay(selectedMonth);
    const ld = lastDay(selectedMonth);

    return contracts.map((c) => {
      const projectId = (c.ph_projects as { id: string; name: string } | undefined)?.id ?? c.project_id;
      const projectName = (c.ph_projects as { name: string } | undefined)?.name ?? '—';

      const installments = (c.ph_installments ?? []) as (PhInstallment & { ph_payments: PhPayment[] })[];

      // Schedule validity check
      const installmentSum = installments.reduce((s, i) => s + Number(i.amount), 0);
      const totalValue = Number(c.total_value);
      const scheduleDiff = Math.abs(Math.round((installmentSum - totalValue) * 1000) / 1000);
      const scheduleValid = scheduleDiff < 0.001;

      // Planning income
      let planningIncome = 0;
      if (scheduleValid) {
        if (c.contract_type === 'maintenance') {
          for (const inst of installments) {
            if (!inst.period_start || !inst.period_end) continue;
            if (!rangeCoversMonth(inst.period_start, inst.period_end, selectedMonth)) continue;
            const ms = monthsSpanned(inst.period_start, inst.period_end);
            planningIncome += Number(inst.amount) / ms;
          }
        } else {
          // implementation: spread total value over contract duration
          if (rangeCoversMonth(c.start_date, c.end_date, selectedMonth)) {
            const ms = monthsSpanned(c.start_date, c.end_date);
            planningIncome = totalValue / ms;
          }
        }
      }

      // Fixed expense share
      const fixedExpenseShare = fixedShare;
      const laborBudget = planningIncome - fixedExpenseShare;

      // Hours logged for this project
      const projectHours = hours.filter((h) => h.project_id === projectId);
      const hoursLogged = projectHours.reduce((s, h) => s + Number(h.hours), 0);
      const actualCost = projectHours.reduce((s, h) => s + Number(h.cost), 0);

      // Hours cap and remaining
      const rateAvailable = planningRate !== null && planningRate > 0;
      let hoursCap: number | null = null;
      let hoursRemaining: number | null = null;
      let overrunKWD = 0;

      if (scheduleValid && rateAvailable && planningRate) {
        hoursCap = Math.max(0, laborBudget / planningRate);
        const remaining = laborBudget - actualCost;
        if (remaining >= 0) {
          hoursRemaining = remaining / planningRate;
        } else {
          hoursRemaining = 0;
          overrunKWD = Math.abs(remaining);
        }
      }

      // Installments due and payments collected in selected month
      const installmentsDue = installments
        .filter((i) => isInMonth(i.due_date, selectedMonth))
        .reduce((s, i) => s + Number(i.amount), 0);

      const paymentsCollected = installments
        .flatMap((i) => i.ph_payments ?? [])
        .filter((p) => isInMonth(p.collection_date, selectedMonth))
        .reduce((s, p) => s + Number(p.amount), 0);

      return {
        projectId,
        projectName,
        contractId: c.id,
        contractType: c.contract_type,
        totalValue,
        contractStart: c.start_date,
        contractEnd: c.end_date,
        installments,
        scheduleValid,
        scheduleDiff: Math.round((installmentSum - totalValue) * 1000) / 1000,
        planningIncome,
        fixedExpenseShare,
        laborBudget,
        hoursLogged,
        actualCost,
        hoursCap,
        hoursRemaining,
        overrunKWD,
        installmentsDue,
        paymentsCollected,
        rateAvailable,
      };
    });
  }, [contracts, hours, expensePeriods, planningRate, selectedMonth, totalFixedExpenses]);

  const othersHours = useMemo(() =>
    hours.filter((h) => h.project_id === null),
    [hours]
  );
  const othersTotalHours = othersHours.reduce((s, h) => s + Number(h.hours), 0);
  const othersTotalCost = othersHours.reduce((s, h) => s + Number(h.cost), 0);

  const anyInvalidSchedule = projectRows.some((r) => !r.scheduleValid);
  const totalPlanningIncome = projectRows.reduce((s, r) => s + r.planningIncome, 0);
  const totalProjectDevCost = projectRows.reduce((s, r) => s + r.actualCost, 0);
  const companyResult = totalPlanningIncome - totalFixedExpenses - totalProjectDevCost - othersTotalCost;
  const totalCashCollected = projectRows.reduce((s, r) => s + r.paymentsCollected, 0);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const noActiveProjects = contracts.length === 0;

  if (authLoading || loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 bg-slate-200 rounded-lg" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Project hours overview for the selected month</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          />
        </div>
      </div>

      {/* Planning rate missing warning */}
      {!planningRate && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>No hourly rate is set for this month. Add a rate in <strong>Expenses &amp; Rates</strong> to see Hours Cap and Hours Remaining.</span>
        </div>
      )}

      {/* Incomplete schedule warning */}
      {anyInvalidSchedule && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            One or more contracts have installment totals that do not match their contract value. The company planning summary is <strong>incomplete</strong>.
            Hours Cap and Hours Remaining are unavailable for affected projects until the schedule is corrected in <strong>Projects &amp; Contracts</strong>.
          </span>
        </div>
      )}

      {/* Main project table */}
      {projectRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <BarChart2 size={32} className="text-indigo-400" />
          </div>
          <p className="text-slate-500 text-center">No active contracts for this month.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 font-medium w-6"></th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium text-right">Hours Cap</th>
                  <th className="px-4 py-3 font-medium text-right">Hours Logged</th>
                  <th className="px-4 py-3 font-medium text-right">Hours Remaining</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <>
                    <tr
                      key={row.contractId}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(row.contractId)}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {expanded.has(row.contractId)
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{row.projectName}</span>
                          {!row.scheduleValid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                              <AlertTriangle size={10} />
                              Schedule mismatch
                            </span>
                          )}
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.contractType === 'maintenance' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {row.contractType === 'maintenance' ? 'Maintenance' : 'Implementation'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {!row.scheduleValid ? (
                          <span className="text-slate-400 text-xs">Unavailable</span>
                        ) : !row.rateAvailable ? (
                          <span className="text-amber-500 text-xs">No rate set</span>
                        ) : (
                          <span>{row.hoursCap!.toFixed(1)} h</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {row.hoursLogged.toFixed(1)} h
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!row.scheduleValid ? (
                          <span className="text-slate-400 text-xs">Unavailable</span>
                        ) : !row.rateAvailable ? (
                          <span className="text-amber-500 text-xs">No rate set</span>
                        ) : row.overrunKWD > 0 ? (
                          <span className="text-red-600 font-medium">0 h <span className="text-xs font-normal">(overrun {KWD(row.overrunKWD)})</span></span>
                        ) : (
                          <span className={row.hoursRemaining! < (row.hoursCap ?? 0) * 0.2 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                            {row.hoursRemaining!.toFixed(1)} h
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Financial breakdown */}
                    {expanded.has(row.contractId) && (
                      <tr key={`${row.contractId}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                        <td></td>
                        <td colSpan={4} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* Schedule mismatch alert */}
                            {!row.scheduleValid && (
                              <div className="md:col-span-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <span>
                                  Installment total ({KWD(row.installments.reduce((s, i) => s + Number(i.amount), 0))}) differs from contract value ({KWD(row.totalValue)}) by{' '}
                                  <strong>{KWD(Math.abs(row.scheduleDiff))}</strong>.
                                  Correct the schedule in Projects &amp; Contracts to restore hours calculations.
                                </span>
                              </div>
                            )}

                            {/* Financial summary */}
                            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Financial Breakdown</p>
                              <FinRow label="Planning Income" value={row.planningIncome} dimmed={!row.scheduleValid} />
                              <FinRow label={`Fixed Expenses (÷ ${contracts.length} project${contracts.length > 1 ? 's' : ''})`} value={-row.fixedExpenseShare} negative />
                              <div className="border-t border-slate-100 pt-2">
                                <FinRow label="Labor Budget" value={row.laborBudget} bold dimmed={!row.scheduleValid} />
                              </div>
                              <FinRow label="Developer Cost (actual)" value={-row.actualCost} negative />
                              <div className="border-t border-slate-100 pt-2">
                                {row.overrunKWD > 0 ? (
                                  <div className="flex justify-between text-xs font-semibold text-red-600">
                                    <span>Budget Overrun</span>
                                    <span>{KWD(row.overrunKWD)}</span>
                                  </div>
                                ) : (
                                  <FinRow label="Remaining Budget" value={row.laborBudget - row.actualCost} bold dimmed={!row.scheduleValid} />
                                )}
                              </div>
                            </div>

                            {/* Hours */}
                            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Hours &amp; Rate</p>
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>Planning Rate</span>
                                <span className="font-medium">{planningRate ? KWD(planningRate) + '/hr' : <span className="text-amber-500">Not set</span>}</span>
                              </div>
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>Break-even Cap</span>
                                <span className="font-medium">
                                  {!row.scheduleValid ? '—' : !row.rateAvailable ? '—' : `${row.hoursCap!.toFixed(1)} h`}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>Hours Logged</span>
                                <span className="font-medium">{row.hoursLogged.toFixed(1)} h ({KWD(row.actualCost)})</span>
                              </div>

                              <div className="border-t border-slate-100 pt-3 mt-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Collections</p>
                                <div className="flex justify-between text-xs text-slate-600">
                                  <span>Installments Due</span>
                                  <span className="font-medium">{KWD(row.installmentsDue)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-600 mt-1">
                                  <span>Payments Collected</span>
                                  <span className="font-medium text-emerald-600">{KWD(row.paymentsCollected)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Others section */}
      {(othersTotalHours > 0 || othersHours.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="font-semibold text-slate-700">Others (non-project hours)</h2>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Total Hours</p>
              <p className="font-semibold text-slate-900">{othersTotalHours.toFixed(1)} h</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Actual Cost</p>
              <p className="font-semibold text-amber-600">{KWD(othersTotalCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Company summary */}
      <div className={`rounded-2xl border shadow-sm p-5 ${anyInvalidSchedule ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-700">Company Summary</h2>
          {anyInvalidSchedule && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <AlertTriangle size={10} />
              Incomplete
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Planning Income" value={KWD(totalPlanningIncome)} sublabel="All active projects" color="indigo" />
          <SummaryCard label="Fixed Expenses" value={KWD(totalFixedExpenses)} sublabel="Shared equally" color="slate" negative />
          <SummaryCard label="Developer Cost" value={KWD(totalProjectDevCost + othersTotalCost)} sublabel={`Projects + Others`} color="amber" negative />
          <SummaryCard
            label="Net Result"
            value={KWD(companyResult)}
            sublabel={anyInvalidSchedule ? 'Incomplete' : (companyResult >= 0 ? 'Surplus' : 'Deficit')}
            color={anyInvalidSchedule ? 'slate' : companyResult >= 0 ? 'emerald' : 'red'}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap gap-6 text-sm">
            {/* Fixed expense breakdown */}
            {expensePeriods.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fixed Expenses Detail</p>
                <div className="space-y-1">
                  {expensePeriods.map((ep) => (
                    <div key={ep.id} className="flex justify-between gap-8 text-xs text-slate-600">
                      <span>{ep.ph_expense_types?.name ?? '—'}</span>
                      <span className="font-medium">{KWD(Number(ep.amount))}/mo</span>
                    </div>
                  ))}
                  {noActiveProjects && expensePeriods.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">No active projects — expenses shown at company level.</p>
                  )}
                </div>
              </div>
            )}

            {/* Cash collected */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cash Collected This Month</p>
              <p className="text-lg font-bold text-emerald-600">{KWD(totalCashCollected)}</p>
            </div>

            {/* Rate info */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Planning Rate</p>
              {planningRate ? (
                <p className="text-sm font-medium text-slate-700">{KWD(planningRate)}/hr <span className="text-xs text-slate-400">(rate on last day of month)</span></p>
              ) : (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Info size={12} />
                  No rate set for this month
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FinRow({ label, value, negative, bold, dimmed }: {
  label: string; value: number; negative?: boolean; bold?: boolean; dimmed?: boolean;
}) {
  const absVal = Math.abs(value);
  const sign = negative || value < 0 ? '-' : '';
  return (
    <div className={`flex justify-between text-xs ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'} ${dimmed ? 'opacity-40' : ''}`}>
      <span>{label}</span>
      <span className={negative ? 'text-red-600' : ''}>{sign}{KWD(absVal)}</span>
    </div>
  );
}

function SummaryCard({ label, value, sublabel, color, negative }: {
  label: string; value: string; sublabel: string; color: string; negative?: boolean;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    slate: 'bg-slate-50 text-slate-600',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className={`rounded-xl p-3 ${colorMap[color] ?? colorMap.slate}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-base font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sublabel}</p>
    </div>
  );
}
