export type ContractType = 'maintenance' | 'implementation';
export type ContractStatus = 'active' | 'completed' | 'cancelled';

export interface PhProject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PhClient {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PhContract {
  id: string;
  user_id: string;
  project_id: string;
  client_id: string;
  contract_type: ContractType;
  total_value: number;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  notes: string | null;
  created_at: string;
  ph_projects?: PhProject;
  ph_clients?: PhClient;
}

export interface PhInstallment {
  id: string;
  contract_id: string;
  user_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  percentage: number | null;
  period_start: string | null;
  period_end: string | null;
  billing_frequency_months: number | null;
  created_at: string;
  ph_payments?: PhPayment[];
}

export interface PhPayment {
  id: string;
  installment_id: string;
  user_id: string;
  amount: number;
  collection_date: string;
  notes: string | null;
  created_at: string;
}

export const KWD = (n: number) =>
  new Intl.NumberFormat('en-KW', {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);

/** Add `months` months to a Date (preserves day-of-month clamped to month end). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Subtract 1 day from a Date. */
export function subDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface MaintenanceInstallmentRow {
  number: number;
  dueDate: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
}

export function generateMaintenanceSchedule(
  startDate: string,
  endDate: string,
  firstDueDate: string,
  installmentAmount: number,
  frequencyMonths: number,
  totalValue: number
): MaintenanceInstallmentRow[] {
  const rows: MaintenanceInstallmentRow[] = [];
  let periodStart = new Date(startDate);
  const contractEnd = new Date(endDate);
  let dueDate = new Date(firstDueDate);
  let runningTotal = 0;
  let number = 1;

  while (periodStart <= contractEnd) {
    const nextPeriodStart = addMonths(periodStart, frequencyMonths);
    const isLast = nextPeriodStart > contractEnd;
    const periodEnd = isLast ? contractEnd : subDay(nextPeriodStart);

    const remaining = Math.round((totalValue - runningTotal) * 1000) / 1000;
    const amount = isLast ? remaining : Math.min(installmentAmount, remaining);

    if (amount <= 0) break;

    rows.push({
      number,
      dueDate: toDateInput(dueDate),
      amount,
      periodStart: toDateInput(periodStart),
      periodEnd: toDateInput(periodEnd),
    });

    runningTotal = Math.round((runningTotal + amount) * 1000) / 1000;
    periodStart = nextPeriodStart;
    dueDate = addMonths(dueDate, frequencyMonths);
    number++;

    if (runningTotal >= totalValue) break;
  }

  return rows;
}
