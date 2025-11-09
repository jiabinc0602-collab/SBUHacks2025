import type { Sentiment, TranscriptSubmission } from '../types'

type NeuralSeekVariableMap = Record<string, unknown>

type NeuralSeekVariablesExpanded = {
  name: string
  value: unknown
}

type NeuralSeekRawResponse = {
  answer?: string
  sourceParts?: unknown[]
  render?: unknown[]
  variables?: NeuralSeekVariableMap
  variablesExpanded?: NeuralSeekVariablesExpanded[]
}

export interface CallAgentResult {
  summary?: string
  nextSteps?: string[]
  actionItems?: string[]
  objections?: string[]
  tags?: string[]
  sentiment: {
    label: Sentiment
    score: number
  }
  durationMinutes?: number
}

export interface FinancialHealthInput {
  companyName: string
  reportingPeriod?: string
  balanceSheet: string
  incomeStatement: string
  cashflowStatement: string
}

export interface FinancialHealthReport {
  companyName: string
  reportingPeriod?: string
  summary: string
  status: string
  score: number
  strengths: string[]
  risks: string[]
  recommendations: string[]
  liquiditySignal?: string
  profitabilitySignal?: string
  runwaySignal?: string
  rawAnswer?: string
}

const baseUrl = import.meta.env.VITE_NEURALSEEK_BASE_URL?.replace(/\/$/, '')
const callAgentName = import.meta.env.VITE_NEURALSEEK_AGENT
const finAgentName = import.meta.env.VITE_NEURALSEEK_FIN_AGENT
const apiKey = import.meta.env.VITE_NEURALSEEK_API_KEY

type AgentParams = Array<{ name: string; value: string }>

const isBaseConfigured = () => Boolean(baseUrl && apiKey)

export const isCallNotesAgentConfigured = () =>
  Boolean(isBaseConfigured() && callAgentName)

export const isFinancialAgentConfigured = () =>
  Boolean(isBaseConfigured() && finAgentName)

const parseArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String).map((entry) => entry.trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((entry) => entry.trim()).filter(Boolean)
      }
    } catch {
      // swallow json parse error and fall through
    }

    return trimmed
      .split(/\r?\n|•|- |\u2022/g)
      .map((entry) => entry.replace(/^[\s-•]+/, '').trim())
      .filter(Boolean)
  }

  return []
}

const parseNumberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

const getStringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const normalizeSentimentLabel = (input: string): Sentiment => {
  const lower = input.toLowerCase()
  if (lower.includes('positive')) return 'Positive'
  if (lower.includes('negative')) return 'Negative'
  if (lower.includes('neutral')) return 'Neutral'
  return 'Neutral'
}

const defaultSentimentScore = (label: Sentiment) => {
  if (label === 'Positive') return 0.6
  if (label === 'Negative') return -0.6
  return 0
}

const parseSentimentValue = (
  value: unknown,
): { label: Sentiment; score: number } => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    typeof (value as { label: unknown }).label === 'string'
  ) {
    const label = normalizeSentimentLabel((value as { label: string }).label)
    const score =
      parseNumberValue((value as { score?: unknown }).score) ??
      defaultSentimentScore(label)
    return { label, score }
  }

  if (typeof value === 'string') {
    const label = normalizeSentimentLabel(value)
    const scoreMatch = value.match(/-?\d+(?:\.\d+)?/)
    const score =
      (scoreMatch ? Number(scoreMatch[0]) : undefined) ??
      defaultSentimentScore(label)
    return { label, score }
  }

  return { label: 'Neutral', score: 0 }
}

const extractVariables = (response: NeuralSeekRawResponse): NeuralSeekVariableMap => {
  const combined: NeuralSeekVariableMap = { ...(response.variables ?? {}) }
  for (const entry of response.variablesExpanded ?? []) {
    combined[entry.name] = entry.value
  }
  return combined
}

const callMaistro = async (
  agent: string | undefined,
  params: AgentParams,
  userId = 'AutoNotesUser',
): Promise<NeuralSeekRawResponse> => {
  if (!isBaseConfigured()) {
    throw new Error('NeuralSeek base URL or API key missing')
  }
  if (!agent) {
    throw new Error('NeuralSeek agent name is missing')
  }

  const response = await fetch(`${baseUrl}/maistro`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ntl: '',
      agent,
      params,
      options: {
        streaming: false,
        user_id: userId,
        lastTurn: [],
      },
      returnVariables: true,
      returnVariablesExpanded: true,
      returnRender: false,
      returnSource: false,
      maxRecursion: 10,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `NeuralSeek request failed with ${response.status}: ${detail || 'Unknown error'}`,
    )
  }

  return (await response.json()) as NeuralSeekRawResponse
}

const buildCallParams = (submission: TranscriptSubmission): AgentParams => {
  const { metadata } = submission
  return [
    { name: 'callTranscript', value: submission.transcript },
    { name: 'callTitle', value: metadata.title ?? '' },
    { name: 'callAccount', value: metadata.account ?? '' },
    { name: 'callContact', value: metadata.contact ?? '' },
    { name: 'callOwner', value: metadata.owner ?? '' },
    { name: 'callSource', value: metadata.source },
    { name: 'callSourceName', value: metadata.sourceName ?? '' },
    { name: 'callMetadata', value: JSON.stringify(metadata) },
  ]
}

export const runCallNotesAgent = async (
  submission: TranscriptSubmission,
): Promise<CallAgentResult> => {
  const raw = await callMaistro(
    callAgentName,
    buildCallParams(submission),
    submission.metadata.owner || 'AutoNotesUser',
  )
  const variables = extractVariables(raw)

  const normalizeArray = (value: unknown) => {
    const parsed = parseArrayValue(value)
    return parsed.length ? parsed : undefined
  }

  return {
    summary: getStringValue(
      variables.summary ?? variables.callSummary ?? raw.answer,
    ),
    nextSteps: normalizeArray(
      variables.nextSteps ?? variables.nextsteps ?? variables.followUps,
    ),
    actionItems: normalizeArray(
      variables.actionItems ?? variables.actionitems ?? variables.nextSteps,
    ),
    objections: normalizeArray(
      variables.objections ?? variables.concerns ?? variables.risks,
    ),
    tags: normalizeArray(variables.tags ?? variables.labels),
    sentiment: parseSentimentValue(
      variables.sentiment ?? variables.sentimentAnalysis,
    ),
    durationMinutes:
      parseNumberValue(
        variables.durationMinutes ?? variables.estimatedDurationMinutes,
      ) ?? undefined,
  }
}

const buildFinancialParams = (input: FinancialHealthInput): AgentParams => [
  { name: 'companyName', value: input.companyName },
  { name: 'reportingPeriod', value: input.reportingPeriod ?? '' },
  { name: 'balanceSheet', value: input.balanceSheet },
  { name: 'incomeStatement', value: input.incomeStatement },
  { name: 'cashflowStatement', value: input.cashflowStatement },
]

const deriveHealthStatus = (score: number | undefined, fallback?: string) => {
  if (fallback) return fallback
  if (typeof score !== 'number') return 'Unknown'
  if (score >= 0.75) return 'Strong'
  if (score >= 0.55) return 'Stable'
  if (score >= 0.35) return 'Watch'
  return 'At Risk'
}

export const runFinancialHealthAgent = async (
  input: FinancialHealthInput,
): Promise<FinancialHealthReport> => {
  const raw = await callMaistro(
    finAgentName,
    buildFinancialParams(input),
    input.companyName || 'FinanceUser',
  )
  const variables = extractVariables(raw)
  const score =
    parseNumberValue(variables.healthScore ?? variables.overallHealthScore) ??
    parseNumberValue(variables.score)
  const summary =
    getStringValue(
      variables.healthSummary ?? variables.summary ?? raw.answer,
    ) ?? 'NeuralSeek did not return a summary.'

  return {
    companyName: input.companyName,
    reportingPeriod: input.reportingPeriod,
    summary,
    status: deriveHealthStatus(
      score,
      getStringValue(variables.healthStatus ?? variables.status),
    ),
    score: typeof score === 'number' ? score : 0,
    strengths:
      parseArrayValue(
        variables.strengths ?? variables.highlights ?? variables.positives,
      ) || [],
    risks:
      parseArrayValue(
        variables.risks ?? variables.riskAlerts ?? variables.concerns,
      ) || [],
    recommendations:
      parseArrayValue(
        variables.recommendations ??
          variables.improvementActions ??
          variables.nextSteps,
      ) || [],
    liquiditySignal:
      getStringValue(
        variables.liquiditySignal ?? variables.liquidity ?? variables.cash,
      ),
    profitabilitySignal: getStringValue(
      variables.profitabilitySignal ??
        variables.profitability ??
        variables.marginTrend,
    ),
    runwaySignal: getStringValue(
      variables.runwaySignal ?? variables.cashRunway ?? variables.burn,
    ),
    rawAnswer: raw.answer,
  }
}
