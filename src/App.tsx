import React, { type ReactNode, useEffect, useMemo, useState } from 'react';

type CashFlowInputs = {
  rent: number;
  rentGrowth: number;
  vacancyRate: number;
  vacancyMonths: number;
  repairsMonthly: number;
  capexMonthly: number;
  managementRate: number;
  hoa: number;
  hoaGrowth: number;
  propertyTax: number;
  taxGrowth: number;
  insurance: number;
  insuranceGrowth: number;
  otherMonthly: number;
  loanBalance: number;
  interestRate: number;
  monthlyPI: number;
  purchasePrice: number;
  initialCashInvested: number;
  appreciationRate: number;
  sellingCostRate: number;
};

type MonthlyRow = {
  month: number;
  yearNumber: number;
  year: string;
  monthInYear: number;
  label: string;
  grossRent: number;
  vacancy: number;
  effectiveRent: number;
  hoaCost: number;
  taxCost: number;
  insuranceCost: number;
  repairs: number;
  capex: number;
  management: number;
  other: number;
  operatingExpenses: number;
  noi: number;
  principal: number;
  interest: number;
  debtService: number;
  cashFlow: number;
  balance: number;
};

type AnnualRow = {
  year: string;
  yearNumber: number;
  grossRent: number;
  effectiveRent: number;
  operatingExpenses: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  principal: number;
  interest: number;
  endingBalance: number;
};

type ReturnMetrics = {
  estimatedSalePrice: number;
  sellingCosts: number;
  netSaleProceeds: number;
  endingLoanBalance: number;
  totalCashFlow: number;
  totalProfit: number;
  irr: number | null;
  equityMultiple: number | null;
  totalROI: number | null;
};

type ViewMode = 'annual' | 'monthly';

type SavedState = {
  inputs: CashFlowInputs;
  years: number;
  view: ViewMode;
};

const BASELINE: CashFlowInputs = {
  rent: 2350,
  rentGrowth: 3,
  vacancyRate: 5,
  vacancyMonths: 0,
  repairsMonthly: 0,
  capexMonthly: 0,
  managementRate: 0,
  hoa: 304,
  hoaGrowth: 3,
  propertyTax: 382.7,
  taxGrowth: 2.5,
  insurance: 32.6,
  insuranceGrowth: 5,
  otherMonthly: 0,
  loanBalance: 214900,
  interestRate: 6.25,
  monthlyPI: 1323.18,
  purchasePrice: 307000,
  initialCashInvested: 92064.41,
  appreciationRate: 3,
  sellingCostRate: 7,
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown, digits = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(toNumber(value));
}

function percent(value: unknown, digits = 1): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toFixed(digits)}%`;
}

function compactMoney(value: unknown): string {
  const n = toNumber(value);
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

function calculateMonthlyRows(inputs: CashFlowInputs, months: number): MonthlyRow[] {
  const rows: MonthlyRow[] = [];
  let balance = toNumber(inputs.loanBalance);
  const monthlyRate = toNumber(inputs.interestRate) / 100 / 12;

  for (let month = 1; month <= months; month += 1) {
    const yearNumber = Math.ceil(month / 12);
    const monthInYear = ((month - 1) % 12) + 1;
    const growthYears = yearNumber - 1;

    const grossRent = toNumber(inputs.rent) * Math.pow(1 + toNumber(inputs.rentGrowth) / 100, growthYears);
    const vacancyMonths = Math.min(Math.max(toNumber(inputs.vacancyMonths), 0), months);
    const vacancyPct = vacancyMonths > 0 ? (vacancyMonths / months) * 100 : toNumber(inputs.vacancyRate);
    const vacancy = grossRent * (vacancyPct / 100);
    const effectiveRent = grossRent - vacancy;

    const hoaCost = toNumber(inputs.hoa) * Math.pow(1 + toNumber(inputs.hoaGrowth) / 100, growthYears);
    const taxCost = toNumber(inputs.propertyTax) * Math.pow(1 + toNumber(inputs.taxGrowth) / 100, growthYears);
    const insuranceCost = toNumber(inputs.insurance) * Math.pow(1 + toNumber(inputs.insuranceGrowth) / 100, growthYears);
    const repairs = toNumber(inputs.repairsMonthly);
    const capex = toNumber(inputs.capexMonthly);
    const management = grossRent * (toNumber(inputs.managementRate) / 100);
    const other = toNumber(inputs.otherMonthly);

    const scheduledPI = toNumber(inputs.monthlyPI);
    const interest = balance * monthlyRate;
    const principal = Math.max(0, Math.min(scheduledPI - interest, balance));
    balance = Math.max(0, balance - principal);

    const operatingExpenses = hoaCost + taxCost + insuranceCost + repairs + capex + management + other;
    const noi = effectiveRent - operatingExpenses;
    const cashFlow = noi - scheduledPI;

    rows.push({
      month,
      yearNumber,
      year: `Year ${yearNumber}`,
      monthInYear,
      label: `Y${yearNumber} M${monthInYear}`,
      grossRent,
      vacancy,
      effectiveRent,
      hoaCost,
      taxCost,
      insuranceCost,
      repairs,
      capex,
      management,
      other,
      operatingExpenses,
      noi,
      principal,
      interest,
      debtService: scheduledPI,
      cashFlow,
      balance,
    });
  }

  return rows;
}

function calculateAnnualRows(monthlyRows: MonthlyRow[], years: number): AnnualRow[] {
  return Array.from({ length: years }, (_, index) => {
    const yearNumber = index + 1;
    const rows = monthlyRows.filter((row) => row.yearNumber === yearNumber);
    const sum = (key: keyof MonthlyRow) => rows.reduce((total, row) => total + toNumber(row[key]), 0);
    const last = rows[rows.length - 1] || {};

    return {
      year: `Year ${yearNumber}`,
      yearNumber,
      grossRent: sum('grossRent'),
      effectiveRent: sum('effectiveRent'),
      operatingExpenses: sum('operatingExpenses'),
      noi: sum('noi'),
      debtService: sum('debtService'),
      cashFlow: sum('cashFlow'),
      principal: sum('principal'),
      interest: sum('interest'),
      endingBalance: toNumber(last.balance),
    };
  });
}

function calculateBreakEvenRent(inputs: CashFlowInputs, totalMonths = 120): number {
  const vacancyPct = toNumber(inputs.vacancyMonths) > 0
    ? Math.min(toNumber(inputs.vacancyMonths), totalMonths) / totalMonths
    : toNumber(inputs.vacancyRate) / 100;

  const variablePct = vacancyPct + toNumber(inputs.managementRate) / 100;

  const fixedCosts =
    toNumber(inputs.monthlyPI) +
    toNumber(inputs.hoa) +
    toNumber(inputs.propertyTax) +
    toNumber(inputs.insurance) +
    toNumber(inputs.otherMonthly) +
    toNumber(inputs.repairsMonthly) +
    toNumber(inputs.capexMonthly);

  return fixedCosts / Math.max(0.01, 1 - variablePct);
}

function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce((total, cashFlow, index) => total + cashFlow / Math.pow(1 + rate, index), 0);
}

function calculateIRR(cashFlows: number[]): number | null {
  const hasPositive = cashFlows.some((cashFlow) => cashFlow > 0);
  const hasNegative = cashFlows.some((cashFlow) => cashFlow < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.9999;
  let high = 10;
  let lowNpv = npv(low, cashFlows);
  let highNpv = npv(high, cashFlows);

  if (lowNpv * highNpv > 0) return null;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const midNpv = npv(mid, cashFlows);
    if (Math.abs(midNpv) < 0.0001) return mid;

    if (lowNpv * midNpv < 0) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }

  return (low + high) / 2;
}

function calculateReturnMetrics(inputs: CashFlowInputs, annualRows: AnnualRow[], years: number): ReturnMetrics {
  const purchasePrice = toNumber(inputs.purchasePrice);
  const initialCashInvested = Math.max(0, toNumber(inputs.initialCashInvested));
  const appreciationRate = toNumber(inputs.appreciationRate) / 100;
  const sellingCostRate = toNumber(inputs.sellingCostRate) / 100;
  const finalRow = annualRows[annualRows.length - 1] || {};
  const endingLoanBalance = toNumber(finalRow.endingBalance);

  const estimatedSalePrice = purchasePrice * Math.pow(1 + appreciationRate, years);
  const sellingCosts = estimatedSalePrice * sellingCostRate;
  const netSaleProceeds = Math.max(0, estimatedSalePrice - sellingCosts - endingLoanBalance);
  const annualCashFlows = annualRows.map((row) => toNumber(row.cashFlow));
  const irrCashFlows = [-initialCashInvested, ...annualCashFlows];

  if (irrCashFlows.length > 1) {
    irrCashFlows[irrCashFlows.length - 1] += netSaleProceeds;
  }

  const irr = calculateIRR(irrCashFlows);
  const totalCashFlow = annualCashFlows.reduce((sum, value) => sum + value, 0);
  const totalProfit = totalCashFlow + netSaleProceeds - initialCashInvested;
  const equityMultiple = initialCashInvested > 0 ? (totalCashFlow + netSaleProceeds) / initialCashInvested : null;
  const totalROI = initialCashInvested > 0 ? totalProfit / initialCashInvested : null;

  return {
    estimatedSalePrice,
    sellingCosts,
    netSaleProceeds,
    endingLoanBalance,
    totalCashFlow,
    totalProfit,
    irr,
    equityMultiple,
    totalROI,
  };
}

const STORAGE_KEY = 'gilpinCashFlowState';

function loadSavedState(): SavedState | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<{
      inputs: Partial<CashFlowInputs>;
      years: unknown;
      view: unknown;
    }>;
    return {
      inputs: { ...BASELINE, ...parsed.inputs },
      years: typeof parsed.years === 'number' ? Math.max(1, Math.min(40, parsed.years)) : 10,
      view: parsed.view === 'monthly' ? 'monthly' : 'annual',
    };
  } catch (error) {
    return null;
  }
}

export default function App() {
  const savedState = typeof window !== 'undefined' ? loadSavedState() : null;
  const [inputs, setInputs] = useState(savedState?.inputs ?? BASELINE);
  const [view, setView] = useState(savedState?.view ?? 'annual');
  const [years, setYears] = useState(savedState?.years ?? 10);

  const totalMonths = years * 12;
  const maxVacancyMonths = totalMonths;
  const monthlyRows = useMemo(() => calculateMonthlyRows(inputs, totalMonths), [inputs, totalMonths]);
  const annualRows = useMemo(() => calculateAnnualRows(monthlyRows, years), [monthlyRows, years]);

  const totals = useMemo(() => {
    const sum = (key: keyof MonthlyRow) => monthlyRows.reduce((total, row) => total + toNumber(row[key]), 0);
    const finalBalance = monthlyRows[monthlyRows.length - 1]?.balance || 0;

    return {
      cashFlow: sum('cashFlow'),
      principal: sum('principal'),
      finalBalance,
    };
  }, [monthlyRows]);

  const breakEvenRent = useMemo(() => calculateBreakEvenRent(inputs, totalMonths), [inputs, totalMonths]);
  const returnMetrics = useMemo(() => calculateReturnMetrics(inputs, annualRows, years), [inputs, annualRows, years]);
  const chartRows = view === 'annual' ? annualRows : monthlyRows;

  function updateInput(key: keyof CashFlowInputs, value: unknown) {
    const nextValue = toNumber(value);
    setInputs((current) => {
      if (key === 'vacancyMonths') {
        return { ...current, [key]: Math.max(0, Math.min(nextValue, maxVacancyMonths)) };
      }
      return { ...current, [key]: nextValue };
    });
  }

  function updateYears(value: unknown) {
    const nextYears = Math.max(1, Math.min(40, Math.round(toNumber(value, 10))));
    setYears(nextYears);
    setInputs((current) => ({
      ...current,
      vacancyMonths: Math.min(current.vacancyMonths, nextYears * 12),
    }));
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ inputs, years, view })
      );
    } catch (error) {
      // ignore localStorage errors
    }
  }, [inputs, years, view]);

  function resetBaseline() {
    setInputs(BASELINE);
    setYears(10);
    setView('annual');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // ignore localStorage errors
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/70 backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">11 Gilpin Court #167</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">Rental Cash Flow Model</h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Baseline uses the closing numbers: $1,323.18 monthly principal and interest, $382.70 monthly taxes, $32.60 monthly insurance, $304 HOA, and no mortgage insurance.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:items-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Holding period</p>
                <p className="text-2xl font-semibold text-slate-950">{years} years</p>
              </div>
              <button onClick={resetBaseline} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md">
                Reset baseline
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Metric title="Projected IRR" value={returnMetrics.irr === null ? 'N/A' : percent(returnMetrics.irr * 100)} note={`Includes sale after ${years} years, debt payoff, and selling costs`} tone={returnMetrics.irr !== null && returnMetrics.irr >= 0 ? 'good' : 'bad'} />
          <Metric title="Equity Multiple" value={returnMetrics.equityMultiple === null ? 'N/A' : `${returnMetrics.equityMultiple.toFixed(2)}x`} note="Total cash returned divided by initial cash invested" />
          <Metric title="Year 1 Monthly Cash Flow" value={money(annualRows[0]?.cashFlow / 12)} note="After vacancy, HOA, taxes, insurance, and debt service" tone={annualRows[0]?.cashFlow >= 0 ? 'good' : 'bad'} />
          <Metric title="Total vacancy months" value={`${inputs.vacancyMonths} months`} note={inputs.vacancyMonths > 0 ? `Spread over ${years} years` : 'Use vacancy allowance rate'} />
          <Metric title={`${years}-Year Cash Flow`} value={money(totals.cashFlow)} note="Before income taxes and depreciation effects" tone={totals.cashFlow >= 0 ? 'good' : 'bad'} />
          <Metric title="Break-Even Rent" value={money(breakEvenRent)} note="Estimated first-month rent needed for $0 cash flow" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-1">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Assumptions</h2>
                  <p className="text-sm text-slate-500">Change the rent and stress-test the deal.</p>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Editable</span>
              </div>

              <FormSection title="Time horizon">
                <RangeField label="Holding period" value={years} onChange={updateYears} min={1} max={40} step={1} suffix="years" />
              </FormSection>

              <FormSection title="Income">
                <NumberField label="Starting monthly rent" value={inputs.rent} onChange={(value) => updateInput('rent', value)} prefix="$" />
                <RangeField label="Annual rent growth" value={inputs.rentGrowth} onChange={(value) => updateInput('rentGrowth', value)} min={0} max={8} step={0.25} suffix="%" />
                <RangeField label="Vacancy allowance" value={inputs.vacancyRate} onChange={(value) => updateInput('vacancyRate', value)} min={0} max={15} step={0.5} suffix="%" />
                <StepperField
                  label="Total vacancy months"
                  value={inputs.vacancyMonths}
                  onChange={(value) => updateInput('vacancyMonths', value)}
                  min={0}
                  max={maxVacancyMonths}
                  step={1}
                  suffix="months"
                />
              </FormSection>

              <FormSection title="Operating costs">
                <NumberField label="Monthly HOA" value={inputs.hoa} onChange={(value) => updateInput('hoa', value)} prefix="$" />
                <RangeField label="HOA annual growth" value={inputs.hoaGrowth} onChange={(value) => updateInput('hoaGrowth', value)} min={0} max={8} step={0.25} suffix="%" />
                <NumberField label="Monthly property tax" value={inputs.propertyTax} onChange={(value) => updateInput('propertyTax', value)} prefix="$" />
                <RangeField label="Tax annual growth" value={inputs.taxGrowth} onChange={(value) => updateInput('taxGrowth', value)} min={0} max={8} step={0.25} suffix="%" />
                <NumberField label="Monthly insurance" value={inputs.insurance} onChange={(value) => updateInput('insurance', value)} prefix="$" />
                <RangeField label="Insurance annual growth" value={inputs.insuranceGrowth} onChange={(value) => updateInput('insuranceGrowth', value)} min={0} max={12} step={0.5} suffix="%" />
                <NumberField label="Other monthly cost" value={inputs.otherMonthly} onChange={(value) => updateInput('otherMonthly', value)} prefix="$" />
              </FormSection>

              <FormSection title="Reserves and management">
                <NumberField label="Monthly repairs" value={inputs.repairsMonthly} onChange={(value) => updateInput('repairsMonthly', value)} prefix="$" />
                <NumberField label="Monthly CapEx" value={inputs.capexMonthly} onChange={(value) => updateInput('capexMonthly', value)} prefix="$" />
                <RangeField label="Property management" value={inputs.managementRate} onChange={(value) => updateInput('managementRate', value)} min={0} max={12} step={0.5} suffix="% of rent" />
              </FormSection>

              <FormSection title="Loan">
                <NumberField label="Loan balance" value={inputs.loanBalance} onChange={(value) => updateInput('loanBalance', value)} prefix="$" />
                <NumberField label="Interest rate" value={inputs.interestRate} onChange={(value) => updateInput('interestRate', value)} suffix="%" />
                <NumberField label="Monthly P&I" value={inputs.monthlyPI} onChange={(value) => updateInput('monthlyPI', value)} prefix="$" />
              </FormSection>

              <FormSection title="Return assumptions">
                <NumberField label="Purchase price" value={inputs.purchasePrice} onChange={(value) => updateInput('purchasePrice', value)} prefix="$" />
                <NumberField label="Initial cash invested" value={inputs.initialCashInvested} onChange={(value) => updateInput('initialCashInvested', value)} prefix="$" />
                <RangeField label="Annual appreciation" value={inputs.appreciationRate} onChange={(value) => updateInput('appreciationRate', value)} min={-5} max={8} step={0.25} suffix="%" />
                <RangeField label="Selling costs" value={inputs.sellingCostRate} onChange={(value) => updateInput('sellingCostRate', value)} min={0} max={12} step={0.25} suffix="%" />
              </FormSection>
            </div>
          </Panel>

          <div className="space-y-6 lg:col-span-2">
            <Panel>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Cash Flow Trend</h2>
                  <p className="text-sm text-slate-500">Hover over the line to see the exact cash-flow value.</p>
                </div>
                <select value={view} onChange={(event) => setView(event.target.value as ViewMode)} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none">
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <SimpleLineChart rows={chartRows} xKey={view === 'annual' ? 'year' : 'label'} yKey="cashFlow" />
            </Panel>

            <Panel>
              <h2 className="text-xl font-semibold text-slate-950">Return on Investment</h2>
              <p className="mb-4 text-sm text-slate-500">IRR includes annual cash flow plus estimated sale proceeds at the end of the selected holding period.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <ReturnItem label="Projected IRR" value={returnMetrics.irr === null ? 'N/A' : percent(returnMetrics.irr * 100)} />
                <ReturnItem label="Total ROI" value={returnMetrics.totalROI === null ? 'N/A' : percent(returnMetrics.totalROI * 100)} />
                <ReturnItem label="Equity multiple" value={returnMetrics.equityMultiple === null ? 'N/A' : `${returnMetrics.equityMultiple.toFixed(2)}x`} />
                <ReturnItem label="Estimated sale price" value={money(returnMetrics.estimatedSalePrice)} />
                <ReturnItem label="Selling costs" value={money(returnMetrics.sellingCosts)} />
                <ReturnItem label="Net sale proceeds" value={money(returnMetrics.netSaleProceeds)} />
                <ReturnItem label="Total cash flow" value={money(returnMetrics.totalCashFlow)} />
                <ReturnItem label="Total profit" value={money(returnMetrics.totalProfit)} />
                <ReturnItem label="Ending loan balance" value={money(returnMetrics.endingLoanBalance)} />
              </div>
            </Panel>

            <Panel>
              <h2 className="text-xl font-semibold text-slate-950">Annual Income vs Costs</h2>
              <p className="mb-4 text-sm text-slate-500">Effective rent is after vacancy. Costs include operating expenses and debt service.</p>
              <SimpleGroupedBarChart rows={annualRows} keys={['effectiveRent', 'operatingExpenses', 'debtService']} labels={['Effective rent', 'Operating expenses', 'Debt service']} />
            </Panel>
          </div>
        </section>

        <Panel>
          <h2 className="text-xl font-semibold text-slate-950">{years}-Year Annual Summary</h2>
          <p className="mb-4 text-sm text-slate-500">Investor view. The app calculates monthly detail and rolls it into annual totals.</p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b text-left text-slate-500">
                  <TableHead>Year</TableHead>
                  <TableHead>Gross Rent</TableHead>
                  <TableHead>Effective Rent</TableHead>
                  <TableHead>OpEx</TableHead>
                  <TableHead>NOI</TableHead>
                  <TableHead>Debt Service</TableHead>
                  <TableHead>Cash Flow</TableHead>
                  <TableHead>Principal Paid</TableHead>
                  <TableHead>Ending Loan</TableHead>
                </tr>
              </thead>
              <tbody className="bg-white">
                {annualRows.map((row) => (
                  <tr key={row.year} className="border-b last:border-0 hover:bg-slate-50/80">
                    <TableCell className="font-medium">{row.year}</TableCell>
                    <TableCell>{money(row.grossRent)}</TableCell>
                    <TableCell>{money(row.effectiveRent)}</TableCell>
                    <TableCell>{money(row.operatingExpenses)}</TableCell>
                    <TableCell>{money(row.noi)}</TableCell>
                    <TableCell>{money(row.debtService)}</TableCell>
                    <TableCell className={row.cashFlow >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{money(row.cashFlow)}</TableCell>
                    <TableCell>{money(row.principal)}</TableCell>
                    <TableCell>{money(row.endingBalance)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-slate-950">Model notes</h2>
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            <p>This is a pre-tax cash-flow model. It does not include depreciation, passive loss limits, income taxes, refinancing, special assessments, legal costs, or tenant turnover costs beyond the vacancy and reserve assumptions.</p>
            <p>IRR assumes the property is sold at the end of the selected holding period. Sale proceeds are estimated as future property value minus selling costs minus remaining loan balance.</p>
            <p>Escrowed taxes and insurance are shown as economic costs even though they are paid through the lender. HOA is modeled separately because the closing disclosure did not escrow HOA dues.</p>
          </div>
        </Panel>
      </div>
    </main>
  );
}

type ChildrenProps = {
  children: ReactNode;
};

type PanelProps = ChildrenProps & {
  className?: string;
};

function Panel({ children, className = '' }: PanelProps) {
  return <section className={`rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur ${className}`}>{children}</section>;
}

type MetricProps = {
  title: string;
  value: string;
  note: string;
  tone?: 'good' | 'bad' | 'neutral';
};

function Metric({ title, value, note, tone = 'neutral' }: MetricProps) {
  const toneClass = tone === 'good' ? 'from-emerald-50 to-white text-emerald-800' : tone === 'bad' ? 'from-rose-50 to-white text-rose-800' : 'from-sky-50 to-white text-slate-950';
  return (
    <section className={`rounded-[1.75rem] border border-white/70 bg-gradient-to-br ${toneClass} p-5 shadow-xl shadow-slate-200/60`}>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
    </section>
  );
}

type ReturnItemProps = {
  label: string;
  value: string;
};

function ReturnItem({ label, value }: ReturnItemProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

type FormSectionProps = ChildrenProps & {
  title: string;
};

function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type NumericFieldProps = {
  label: string;
  value: number;
  onChange: (value: string | number) => void;
  prefix?: string;
  suffix?: string;
};

function NumberField({ label, value, onChange, prefix = '', suffix = '' }: NumericFieldProps) {
  return (
    <label className="grid grid-cols-2 items-center gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium shadow-inner shadow-slate-100 transition focus:border-sky-500 focus:bg-white focus:outline-none ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-9' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}

type RangeFieldProps = {
  label: string;
  value: number;
  onChange: (value: string | number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

function RangeField({ label, value, onChange, min, max, step, suffix }: RangeFieldProps) {
  const displaySuffix = suffix.startsWith('%') ? suffix : ` ${suffix}`;
  return (
    <label className="block space-y-2 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-slate-600">{label}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">{value}{displaySuffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="w-full accent-sky-700" />
    </label>
  );
}

type StepperFieldProps = RangeFieldProps & {
  step?: number;
};

function StepperField({ label, value, onChange, min, max, step = 1, suffix = '' }: StepperFieldProps) {
  const displaySuffix = suffix.startsWith('%') ? suffix : ` ${suffix}`;
  function changeBy(delta: number) {
    onChange(Math.max(min, Math.min(max, value + delta)));
  }

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">{label}</span>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeBy(-step)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={value <= min}
          >
            −
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">{value}{displaySuffix}</span>
          <button
            type="button"
            onClick={() => changeBy(step)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={value >= max}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function TableHead({ children }: ChildrenProps) {
  return <th className="py-3 pl-4 pr-4 font-semibold">{children}</th>;
}

type TableCellProps = ChildrenProps & {
  className?: string;
};

function TableCell({ children, className = '' }: TableCellProps) {
  return <td className={`py-3 pl-4 pr-4 ${className}`}>{children}</td>;
}

type ChartRow = MonthlyRow | AnnualRow;

type SimpleLineChartProps = {
  rows: ChartRow[];
  xKey: 'year' | 'label';
  yKey: 'cashFlow';
};

type Point = {
  x: number;
  y: number;
};

function chartLabel(row: ChartRow, xKey: SimpleLineChartProps['xKey']): string {
  if (xKey === 'label') return 'label' in row ? row.label : row.year;
  return row.year;
}

function SimpleLineChart({ rows, xKey, yKey }: SimpleLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 820;
  const height = 330;
  const padding = { top: 26, right: 34, bottom: 52, left: 74 };
  const values = rows.map((row) => toNumber(row[yKey]));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const pointFor = (row: ChartRow, index: number): Point => {
    const x = padding.left + (rows.length === 1 ? 0 : (index / (rows.length - 1)) * plotWidth);
    const y = padding.top + ((maxValue - toNumber(row[yKey])) / range) * plotHeight;
    return { x, y };
  };

  const points = rows.map(pointFor);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1]?.x || padding.left},${padding.top + plotHeight} L${padding.left},${padding.top + plotHeight} Z`;
  const zeroY = padding.top + ((maxValue - 0) / range) * plotHeight;
  const tickValues = [minValue, minValue + range / 2, maxValue];
  const hoverRow = hoverIndex !== null ? rows[hoverIndex] : null;
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  const pointEvery = Math.max(1, Math.ceil(rows.length / 30));

  return (
    <div className="relative w-full overflow-x-auto rounded-3xl bg-slate-50/80 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[350px] min-w-[760px] w-full" role="img" aria-label="Cash flow line chart">
        <defs>
          <linearGradient id="cashFlowFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="24" fill="#f8fafc" />
        {tickValues.map((tick) => {
          const y = padding.top + ((maxValue - tick) / range) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dbe4ef" strokeDasharray="5 5" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">{compactMoney(tick)}</text>
            </g>
          );
        })}
        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth="1.2" />
        <path d={areaPath} fill="url(#cashFlowFill)" />
        <path d={path} fill="none" stroke="#0284c7" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (index % pointEvery === 0 || index === rows.length - 1 ? <circle key={index} cx={point.x} cy={point.y} r="3.4" fill="#0284c7" stroke="white" strokeWidth="2" /> : null))}
        {hoverRow && hoverPoint && (
          <g>
            <line x1={hoverPoint.x} x2={hoverPoint.x} y1={padding.top} y2={padding.top + plotHeight} stroke="#0f172a" strokeOpacity="0.25" strokeDasharray="4 4" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="6" fill="#0f172a" stroke="white" strokeWidth="3" />
            <g transform={`translate(${Math.min(Math.max(hoverPoint.x - 92, padding.left), width - padding.right - 184)}, ${Math.max(hoverPoint.y - 74, 10)})`}>
              <rect width="184" height="58" rx="14" fill="#0f172a" opacity="0.94" />
              <text x="14" y="22" fontSize="12" fill="#cbd5e1">{chartLabel(hoverRow, xKey)}</text>
              <text x="14" y="44" fontSize="18" fontWeight="700" fill="white">{money(hoverRow[yKey])}</text>
            </g>
          </g>
        )}
        {rows.map((row, index) => {
          const point = points[index];
          return (
            <rect
              key={`hover-${'label' in row ? row.label : row.year}-${index}`}
              x={index === 0 ? padding.left : point.x - plotWidth / Math.max(rows.length - 1, 1) / 2}
              y={padding.top}
              width={Math.max(8, plotWidth / Math.max(rows.length - 1, 1))}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
              onMouseMove={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          );
        })}
        {rows.map((row, index) => {
          if (index % labelEvery !== 0 && index !== rows.length - 1) return null;
          const point = points[index];
          const label = chartLabel(row, xKey);
          return <text key={`${label}-${index}`} x={point.x} y={height - 18} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#64748b">{label}</text>;
        })}
      </svg>
    </div>
  );
}

type AnnualBarKey = 'effectiveRent' | 'operatingExpenses' | 'debtService';

type SimpleGroupedBarChartProps = {
  rows: AnnualRow[];
  keys: AnnualBarKey[];
  labels: string[];
};

type HoveredBar = {
  rowIndex: number;
  keyIndex: number;
  label: string;
  value: number;
  x: number;
  y: number;
  year: string;
};

function SimpleGroupedBarChart({ rows, keys, labels }: SimpleGroupedBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null);
  const width = 820;
  const height = 380;
  const padding = { top: 28, right: 34, bottom: 92, left: 74 };
  const maxValue = Math.max(...rows.flatMap((row) => keys.map((key) => toNumber(row[key]))), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const groupWidth = plotWidth / rows.length;
  const barWidth = Math.max(4, Math.min(16, groupWidth / (keys.length + 1.8)));
  const fills = ['#0f172a', '#64748b', '#cbd5e1'];
  const ticks = [0, maxValue / 2, maxValue];
  const labelEvery = Math.max(1, Math.ceil(rows.length / 12));
  const tooltipWidth = 210;
  const tooltipHeight = 72;

  return (
    <div className="w-full overflow-x-auto rounded-3xl bg-slate-50/80 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[400px] min-w-[760px] w-full" role="img" aria-label="Annual income versus costs bar chart">
        <rect x="0" y="0" width={width} height={height} rx="24" fill="#f8fafc" />
        {ticks.map((tick) => {
          const y = padding.top + ((maxValue - tick) / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dbe4ef" strokeDasharray="5 5" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">{compactMoney(tick)}</text>
            </g>
          );
        })}
        {rows.map((row, rowIndex) => {
          const groupX = padding.left + rowIndex * groupWidth;
          const startX = groupX + (groupWidth - keys.length * barWidth) / 2;
          return (
            <g key={row.year}>
              {keys.map((key, keyIndex) => {
                const value = toNumber(row[key]);
                const barHeight = (value / maxValue) * plotHeight;
                const x = startX + keyIndex * barWidth;
                const y = padding.top + plotHeight - barHeight;
                const isHovered = hoveredBar?.rowIndex === rowIndex && hoveredBar?.keyIndex === keyIndex;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={barWidth * 0.78}
                    height={barHeight}
                    rx="6"
                    fill={fills[keyIndex % fills.length]}
                    opacity={hoveredBar && !isHovered ? 0.45 : 1}
                    stroke={isHovered ? '#0284c7' : 'transparent'}
                    strokeWidth={isHovered ? 2 : 0}
                    onMouseEnter={() => setHoveredBar({ rowIndex, keyIndex, label: labels[keyIndex], value, x: x + (barWidth * 0.78) / 2, y, year: row.year })}
                    onMouseMove={() => setHoveredBar({ rowIndex, keyIndex, label: labels[keyIndex], value, x: x + (barWidth * 0.78) / 2, y, year: row.year })}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                );
              })}
              {(rowIndex % labelEvery === 0 || rowIndex === rows.length - 1) && <text x={groupX + groupWidth / 2} y={height - 48} textAnchor="middle" fontSize="11" fill="#64748b">Y{row.yearNumber}</text>}
            </g>
          );
        })}
        {hoveredBar && (
          <g transform={`translate(${Math.min(Math.max(hoveredBar.x - tooltipWidth / 2, padding.left), width - padding.right - tooltipWidth)}, ${Math.max(hoveredBar.y - tooltipHeight - 10, 10)})`} pointerEvents="none">
            <rect width={tooltipWidth} height={tooltipHeight} rx="16" fill="#0f172a" opacity="0.94" />
            <text x="14" y="22" fontSize="12" fill="#cbd5e1">{hoveredBar.year}</text>
            <text x="14" y="43" fontSize="13" fontWeight="600" fill="#e2e8f0">{hoveredBar.label}</text>
            <text x="14" y="64" fontSize="18" fontWeight="700" fill="white">{money(hoveredBar.value)}</text>
          </g>
        )}
        <g transform={`translate(${padding.left}, ${height - 24})`}>
          {labels.map((label, index) => (
            <g key={label} transform={`translate(${index * 210}, 0)`}>
              <rect width="11" height="11" rx="3" fill={fills[index % fills.length]} />
              <text x="18" y="11" fontSize="12" fill="#475569">{label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
