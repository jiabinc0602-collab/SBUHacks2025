import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import {
  isFinancialAgentConfigured,
  runFinancialHealthAgent,
  type FinancialHealthInput,
  type FinancialHealthReport,
} from '../utils/neuralseek'

const emptyForm: FinancialHealthInput = {
  companyName: '',
  reportingPeriod: '',
  balanceSheet: '',
  incomeStatement: '',
  cashflowStatement: '',
}

const statusStyles: Record<string, string> = {
  Strong: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Stable: 'bg-sky-50 text-sky-700 border-sky-100',
  Watch: 'bg-amber-50 text-amber-700 border-amber-100',
  'At Risk': 'bg-rose-50 text-rose-700 border-rose-100',
  Unknown: 'bg-slate-50 text-slate-600 border-slate-100',
}

export const FinancialHealthPage = () => {
  const [form, setForm] = useState<FinancialHealthInput>(emptyForm)
  const [report, setReport] = useState<FinancialHealthReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const agentConfigured = useMemo(() => isFinancialAgentConfigured(), [])

  const updateField = (field: keyof FinancialHealthInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!form.companyName.trim()) {
      setError('Add your company name so we can tag the report.')
      return
    }

    if (
      !form.balanceSheet.trim() ||
      !form.incomeStatement.trim() ||
      !form.cashflowStatement.trim()
    ) {
      setError('Paste the balance sheet, income statement, and cash flow statement.')
      return
    }

    if (!agentConfigured) {
      setError('NeuralSeek Financial agent is not configured yet.')
      return
    }

    try {
      setIsLoading(true)
      const result = await runFinancialHealthAgent(form)
      setReport(result)
    } catch (err) {
      console.error(err)
      setError(
        'NeuralSeek could not score your financials. Double-check the .env values and try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const renderList = (title: string, items: string[]) => (
    <div className="glass-panel rounded-2xl p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {items.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No data returned.</p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial health snapshot"
        subtitle="Drop in your core financial statements and let NeuralSeek summarize runway, strengths, and risks."
      />

      {!agentConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Set `VITE_NEURALSEEK_FIN_AGENT` in your `.env` to enable this workflow.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-600">
              Company name
              <input
                type="text"
                value={form.companyName}
                onChange={(event) => updateField('companyName', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Acme Corp"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Reporting period
              <input
                type="text"
                value={form.reportingPeriod}
                onChange={(event) => updateField('reportingPeriod', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Q3 FY25"
              />
            </label>
          </div>

          {(
            [
              ['balanceSheet', 'Balance sheet (assets, liabilities, equity)'],
              ['incomeStatement', 'Income statement / P&L'],
              ['cashflowStatement', 'Cash flow statement'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="mt-4 block text-sm font-semibold text-slate-600">
              {label}
              <textarea
                value={form[field]}
                onChange={(event) => updateField(field, event.target.value)}
                className="mt-2 h-40 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Paste the statement or summarized figures"
              />
            </label>
          ))}

          {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isLoading ? 'Scoring financial health…' : 'Analyze financial health'}
            </button>
            <p className="text-sm text-slate-500">
              NeuralSeek highlights strengths, risks, and runway from the statements.
            </p>
          </div>
        </form>

        <div className="space-y-4">
          {report ? (
            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-5 ${
                  statusStyles[report.status] ?? statusStyles.Unknown
                }`}
              >
                <p className="text-xs uppercase tracking-wide">Overall Health</p>
                <h3 className="mt-1 text-2xl font-semibold">{report.status}</h3>
                <p className="mt-2 text-sm">
                  Score: <span className="font-semibold">{report.score.toFixed(2)}</span>
                  {report.reportingPeriod && ` · ${report.reportingPeriod}`}
                </p>
                <p className="mt-3 text-sm text-slate-700">{report.summary}</p>
                <dl className="mt-4 grid gap-3 text-sm">
                  {report.liquiditySignal && (
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Liquidity</dt>
                      <dd className="font-medium text-slate-900">{report.liquiditySignal}</dd>
                    </div>
                  )}
                  {report.profitabilitySignal && (
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Profitability</dt>
                      <dd className="font-medium text-slate-900">{report.profitabilitySignal}</dd>
                    </div>
                  )}
                  {report.runwaySignal && (
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Runway</dt>
                      <dd className="font-medium text-slate-900">{report.runwaySignal}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {renderList('Core strengths', report.strengths)}
              {renderList('Watch outs', report.risks)}
              {renderList('Recommended actions', report.recommendations)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Submit your financials to see instant health scoring, runway signals, and action items.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
