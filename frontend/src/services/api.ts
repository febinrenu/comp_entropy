import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface DashboardStats {
  total_experiments: number;
  completed_experiments: number;
  total_prompts: number;
  total_measurements: number;
  total_energy_kwh: number;
  total_carbon_kg: number;
  avg_pec_score: number | null;
}

export interface Experiment {
  id: number;
  name: string;
  description: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: string | null;
  num_prompts: number;
  runs_per_prompt: number;
  total_measurements: number;
  pec_score: number | null;
  total_energy_kwh: number | null;
  total_carbon_kg: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  model_name: string | null;
  mutation_types?: string[];
}

export interface ExperimentCreate {
  name: string;
  description?: string;
  mutation_types: string[];
  num_prompts: number;
  runs_per_prompt: number;
  warmup_runs: number;
  config?: {
    provider?: string;
    model?: string;
    api_key?: string;
    model_name?: string;
    max_tokens?: number;
    temperature?: number;
  };
}

export interface Prompt {
  id: number;
  experiment_id: number;
  parent_id: number | null;
  text: string;
  mutation_type: string;
  mutation_intensity: number;
  word_count: number | null;
  human_ambiguity_score: number | null;
  semantic_instability_index: number | null;
  stability_score: number | null;
  severity_level: number | null;
  token_count: number | null;
  created_at: string;
}

export interface Measurement {
  id: number;
  experiment_id: number;
  prompt_id: number;
  run_number: number;
  is_warmup: boolean;
  total_energy_joules: number | null;
  total_time_seconds: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  energy_per_token_mj: number | null;
  tokens_per_second: number | null;
  is_valid: boolean;
  created_at: string;
  // Additional fields used by Measurements page
  prompt?: Prompt;
  energy_joules?: number;
  inference_time?: number;
  total_tokens?: number;
  gpu_power_watts?: number;
}

export interface MeasurementListResponse {
  measurements: Measurement[];
  total: number;
}

export interface AnalysisReport {
  experiment: {
    id: number;
    name: string;
    total_measurements: number;
  };
  pec_analysis: {
    pec_score: number;
    p_value: number;
    ci_lower: number;
    ci_upper: number;
    is_significant: boolean;
    interpretation: string;
    significance_explanation?: string;
    statistical_notes?: {
      test_used: string;
      null_hypothesis: string;
      significance_level: string;
      what_it_means: string;
    };
  };
  anova_analysis: {
    groups: string[];
    group_means: number[];
    anova: {
      f_statistic: number;
      p_value: number;
      is_significant: boolean;
    };
    effect_sizes: {
      eta_squared: number;
      interpretation: string;
    };
    anova_interpretation?: string;
    effect_meaning?: string;
    statistical_notes?: {
      test_description: string;
      null_hypothesis: string;
      f_value_meaning: string;
      p_value_meaning: string;
    };
  };
  effect_sizes: Array<{
    comparison: string;
    cohens_d: number;
    percent_change: number;
    interpretation: string;
    practical_meaning?: string;
  }>;
  recommendations: string[];
}

// API Functions
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getRecentExperiments: (limit = 5) => 
    api.get<Experiment[]>(`/dashboard/recent-experiments?limit=${limit}`),
  getRunningExperiments: () => 
    api.get<Experiment[]>('/dashboard/running-experiments'),
  getEnergyTimeline: (days = 30) =>
    api.get(`/dashboard/energy-over-time?days=${days}`),
  getMutationComparison: () =>
    api.get('/dashboard/mutation-comparison'),
  getSystemStatus: () =>
    api.get('/dashboard/system-status'),
};

export const experimentsApi = {
  list: (page = 1, pageSize = 20, status?: string) => {
    let url = `/experiments/?page=${page}&page_size=${pageSize}`;
    if (status) url += `&status=${status}`;
    return api.get(url);
  },
  get: (id: number) => api.get<Experiment>(`/experiments/${id}`),
  create: (data: ExperimentCreate) => api.post<Experiment>('/experiments/', data),
  update: (id: number, data: Partial<Experiment>) => 
    api.patch<Experiment>(`/experiments/${id}`, data),
  delete: (id: number) => api.delete(`/experiments/${id}`),
  run: (id: number) => api.post<Experiment>(`/experiments/${id}/run`),
  cancel: (id: number) => api.post<Experiment>(`/experiments/${id}/cancel`),
  getStats: (id: number) => api.get(`/experiments/${id}/stats`),
};

export const promptsApi = {
  list: (page = 1, pageSize = 20, mutationType?: string) => {
    let url = `/prompts/?page=${page}&page_size=${pageSize}`;
    if (mutationType) url += `&mutation_type=${mutationType}`;
    return api.get(url);
  },
  listForExperiment: (experimentId: number, mutationType?: string) => {
    let url = `/prompts/experiment/${experimentId}`;
    if (mutationType) url += `?mutation_type=${mutationType}`;
    return api.get<Prompt[]>(url);
  },
  get: (id: number) => api.get<Prompt>(`/prompts/${id}`),
  create: (data: { text: string; mutation_type: string }) =>
    api.post<Prompt>('/prompts/', data),
  delete: (id: number) => api.delete(`/prompts/${id}`),
  mutate: (text: string, mutationType: string, intensity = 0.5) =>
    api.post<Prompt>(`/prompts/mutate?original_text=${encodeURIComponent(text)}&mutation_type=${mutationType}&intensity=${intensity}`),
  submitValidation: (data: { prompt_id: number; ambiguity_score: number; clarity_score: number }) =>
    api.post('/prompts/validate', data),
  getForValidation: (experimentId: number, limit = 10) =>
    api.get(`/prompts/experiment/${experimentId}/for-validation?limit=${limit}`),
};

export const measurementsApi = {
  list: (page = 1, pageSize = 20, experimentId?: number) => {
    let url = `/measurements/?page=${page}&page_size=${pageSize}`;
    if (experimentId) url += `&experiment_id=${experimentId}`;
    return api.get<MeasurementListResponse>(url);
  },
  listForExperiment: (experimentId: number, includeWarmup = false) =>
    api.get<Measurement[]>(`/measurements/experiment/${experimentId}?include_warmup=${includeWarmup}`),
  listForPrompt: (promptId: number) =>
    api.get<Measurement[]>(`/measurements/prompt/${promptId}`),
  getAggregated: (experimentId: number, groupBy = 'mutation_type') =>
    api.get(`/measurements/experiment/${experimentId}/aggregated?group_by=${groupBy}`),
  getTimeline: (experimentId: number) =>
    api.get(`/measurements/experiment/${experimentId}/timeline`),
  getDistribution: (experimentId: number) =>
    api.get(`/measurements/experiment/${experimentId}/distribution`),
};

export const analysisApi = {
  listResults: (experimentId: number, analysisType?: string) => {
    let url = `/analysis/experiment/${experimentId}`;
    if (analysisType) url += `?analysis_type=${analysisType}`;
    return api.get(url);
  },
  runAnalysis: (experimentId: number, includeBayesian = false) =>
    api.post(`/analysis/experiment/${experimentId}/run?include_bayesian=${includeBayesian}`),
  getPEC: (experimentId: number) =>
    api.get(`/analysis/experiment/${experimentId}/pec`),
  getCorrelations: (experimentId: number, method = 'spearman') =>
    api.get(`/analysis/experiment/${experimentId}/correlations?method=${method}`),
  getANOVA: (experimentId: number) =>
    api.get(`/analysis/experiment/${experimentId}/anova`),
  getEffectSizes: (experimentId: number) =>
    api.get(`/analysis/experiment/${experimentId}/effect-sizes`),
  getFullReport: (experimentId: number) =>
    api.get<AnalysisReport>(`/analysis/experiment/${experimentId}/report`),
  getLatexTables: (experimentId: number, tableType = 'all') =>
    api.get(`/analysis/experiment/${experimentId}/latex-tables?table_type=${tableType}`),
  getRecommendations: (experimentId: number) =>
    api.get(`/analysis/experiment/${experimentId}/recommendations`),
};

export const exportApi = {
  downloadCSV: (experimentId: number, dataType = 'measurements') =>
    `${API_BASE_URL}/export/experiment/${experimentId}/csv?data_type=${dataType}`,
  downloadJSON: (experimentId: number) =>
    `${API_BASE_URL}/export/experiment/${experimentId}/json`,
  downloadLatex: (experimentId: number) =>
    `${API_BASE_URL}/export/experiment/${experimentId}/latex`,
  downloadReproducibility: (experimentId: number) =>
    `${API_BASE_URL}/export/experiment/${experimentId}/reproducibility-package`,
  exportMeasurements: (experimentId?: number, format = 'csv') =>
    api.get(`/export/measurements?format=${format}${experimentId ? `&experiment_id=${experimentId}` : ''}`, { responseType: 'blob' }),
};

// Settings API
export interface Settings {
  provider: string;
  openai_model: string;
  anthropic_model: string;
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  temperature: number;
  max_tokens: number;
}

export interface SettingsUpdate {
  provider?: string;
  openai_api_key?: string;
  openai_model?: string;
  anthropic_api_key?: string;
  anthropic_model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  models: string[];
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings/'),
  update: (data: SettingsUpdate) => api.patch<Settings>('/settings/', data),
  getProviders: () => api.get<{ providers: Provider[] }>('/settings/providers'),
  testConnection: (provider: string) => 
    api.post<{ success: boolean; message: string }>(`/settings/test-connection?provider=${provider}`),
};

// Demo API
export interface DemoStats {
  stats_by_mutation_type: Record<string, {
    avg_energy: number;
    avg_time: number;
    avg_tokens: number;
    count: number;
    energy_change_percent?: number;
  }>;
  total_experiments: number;
  total_measurements: number;
  key_finding: {
    elaborate_increase: number;
    simplify_decrease: number;
    correlation_coefficient: number;
    p_value: number;
    effect_size: number;
  };
}

export interface QuickExperimentResult {
  original_prompt: string;
  results: Array<{
    mutation_type: string;
    prompt: string;
    energy_consumed: number;
    tokens_generated: number;
    inference_time: number;
    tokens_per_second: number;
    energy_change_percent?: number;
  }>;
  summary: {
    most_efficient: string;
    least_efficient: string;
    potential_savings_percent: number;
  };
}

export const demoApi = {
  seedData: () => api.post('/demo/seed'),
  getStats: () => api.get<DemoStats>('/demo/stats'),
  runQuickExperiment: (prompt: string, mutationType?: string) => 
    api.post<QuickExperimentResult>('/demo/quick-experiment', null, {
      params: { prompt, mutation_type: mutationType || 'all' }
    }),
  getCorrelationData: () => api.get('/demo/correlation-data'),
};

export default api;
