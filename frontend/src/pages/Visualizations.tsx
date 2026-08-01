import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { experimentsApi, measurementsApi, demoApi, analysisApi } from '../services/api';
import StatisticalSignificance from '../components/StatisticalSignificance';
import LiveMonitor from '../components/LiveMonitor';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#ec4899'];

// Type definitions for chart data
interface MutationDataItem {
  mutation: string;
  avgEnergy: number;
  avgTime: number;
  avgTokens: number;
  count: number;
  changePercent?: number;
}

interface PecDistributionItem {
  name: string;
  value: number;
  percent?: string | number;
}

interface ScatterDataItem {
  tokens: number;
  energy: number;
  wordCount?: number;
  type?: string;
}

const Visualizations: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chartAxisColor = isDark ? '#94a3b8' : '#64748b';
  const chartGridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const chartTooltipStyle = {
    backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
    borderRadius: 8,
    color: isDark ? '#f1f5f9' : '#0f172a',
  };
  const chartTooltipLabelStyle = { color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600 };
  const chartTooltipItemStyle = { color: isDark ? '#f1f5f9' : '#0f172a' };
  const [activeTab, setActiveTab] = useState(0);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('all');

  // Fetch experiments
  const { data: experimentsData } = useQuery({
    queryKey: ['experiments-for-viz'],
    queryFn: () => experimentsApi.list(1, 100, 'completed').then(res => res.data),
  });

  // Fetch measurements for selected experiment
  const { data: measurementsData, isLoading: measurementsLoading } = useQuery({
    queryKey: ['measurements-viz', selectedExperiment],
    queryFn: async () => {
      if (selectedExperiment === 'all') {
        // Get aggregated data from demo stats
        const stats = await demoApi.getStats();
        return stats.data;
      } else {
        const measurements = await measurementsApi.listForExperiment(parseInt(selectedExperiment));
        const aggregated = await measurementsApi.getAggregated(parseInt(selectedExperiment));
        return { measurements: measurements.data, aggregated: aggregated.data };
      }
    },
  });

  // Fetch correlation data
  const { data: correlationData } = useQuery({
    queryKey: ['correlation-viz', selectedExperiment],
    queryFn: () => demoApi.getCorrelationData().then(res => res.data),
    enabled: selectedExperiment === 'all',
  });

  // Process data for charts
  const mutationData: MutationDataItem[] = React.useMemo(() => {
    if (!measurementsData) return [];
    
    const data = measurementsData as any;
    
    if (selectedExperiment === 'all' && data.stats_by_mutation_type) {
      return Object.entries(data.stats_by_mutation_type).map(([type, stats]: [string, any]) => ({
        mutation: type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        avgEnergy: stats.avg_energy || 0,
        avgTime: stats.avg_time || 0,
        avgTokens: stats.avg_tokens || 0,
        count: stats.count || 0,
        changePercent: stats.energy_change_percent || 0,
      }));
    }
    
    if (data.aggregated) {
      return data.aggregated.map((item: any) => ({
        mutation: item.mutation_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown',
        avgEnergy: item.avg_energy || 0,
        avgTime: item.avg_time || 0,
        avgTokens: item.avg_tokens || 0,
        count: item.count || 0,
      }));
    }
    
    return [];
  }, [measurementsData, selectedExperiment]);

  // No Math.random() fallbacks: an empty array here renders the existing
  // "no data available" empty state below, rather than silently showing
  // fabricated data indistinguishable from a real chart.
  const timeData = React.useMemo(() => {
    const data = measurementsData as any;
    if (!data?.measurements) return [];
    return data.measurements.slice(0, 30).map((m: any, i: number) => ({
      time: `${i}`,
      energy: m.total_energy_joules ?? m.energy_joules ?? 0,
    }));
  }, [measurementsData]);

  const scatterData: ScatterDataItem[] = React.useMemo(() => {
    if (correlationData?.data_points) {
      return correlationData.data_points.map((d: any) => ({
        tokens: d.tokens || 0,
        energy: d.energy || 0,
        wordCount: d.word_count || 0,
        type: d.mutation_type || 'baseline',
      }));
    }

    const data = measurementsData as any;
    if (data?.measurements) {
      return data.measurements.map((m: any) => ({
        tokens: m.output_tokens ?? m.total_tokens ?? 0,
        energy: m.total_energy_joules ?? 0,
        type: 'measurement',
      }));
    }

    return [];
  }, [correlationData, measurementsData]);

  const pecDistribution: PecDistributionItem[] = React.useMemo(() => {
    if (mutationData.length === 0) return [];
    const total = mutationData.reduce((sum: number, d: MutationDataItem) => sum + d.count, 0);
    return mutationData.map((d: MutationDataItem) => ({
      name: d.mutation,
      value: d.count,
      percent: total > 0 ? ((d.count / total) * 100).toFixed(1) : 0,
    }));
  }, [mutationData]);

  // Radar dimensions beyond Energy/Tokens/Time (Efficiency, Consistency)
  // were previously fixed constants unconnected to any real measurement --
  // removed rather than kept as fabricated filler.
  const radarData = React.useMemo(() => {
    if (mutationData.length < 2) return [];
    const baseline = mutationData.find((d: MutationDataItem) => d.mutation.toLowerCase().includes('baseline'));
    if (!baseline) return [];
    const maxEnergy = Math.max(...mutationData.map((d: MutationDataItem) => d.avgEnergy)) || 1;
    const maxTokens = Math.max(...mutationData.map((d: MutationDataItem) => d.avgTokens)) || 1;
    const maxTime = Math.max(...mutationData.map((d: MutationDataItem) => d.avgTime)) || 1;

    return [
      { dimension: 'Energy', baseline: (baseline.avgEnergy / maxEnergy) * 100 },
      { dimension: 'Tokens', baseline: (baseline.avgTokens / maxTokens) * 100 },
      { dimension: 'Time', baseline: (baseline.avgTime / maxTime) * 100 },
    ];
  }, [mutationData]);

  // Real correlation matrix (GET /analysis/experiment/{id}/correlations) --
  // requires one specific experiment; "All Experiments (Aggregated)" has no
  // single experiment_id to query against, so the matrix tab explains that
  // rather than rendering Math.random() values as if they were real.
  const { data: correlationMatrix, isLoading: correlationMatrixLoading } = useQuery({
    queryKey: ['correlation-matrix', selectedExperiment],
    queryFn: () => analysisApi.getCorrelations(parseInt(selectedExperiment), 'spearman').then(res => res.data),
    enabled: selectedExperiment !== 'all',
  });

  const tabs = [
    { label: 'Overview' },
    { label: 'Statistical Analysis' },
    { label: 'Live Monitor' },
    { label: 'Heatmaps' },
  ];

  const experiments = experimentsData?.experiments || [];

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Visualizations
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real measurement data for the selected experiment -- charts show an explicit
            empty state rather than placeholder data when there isn't enough to plot.
          </Typography>
        </Box>
      </motion.div>

      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontSize: '1rem',
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab key={index} label={tab.label} sx={{ '&.Mui-selected': { fontWeight: 600 } }} />
          ))}
        </Tabs>
      </Card>

      {/* Filter Bar */}
      {activeTab === 0 && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Experiment</InputLabel>
                <Select
                  value={selectedExperiment}
                  onChange={(e) => setSelectedExperiment(e.target.value)}
                  label="Experiment"
                >
                  <MenuItem value="all">All Experiments (Aggregated)</MenuItem>
                  {experiments.map((exp: any) => (
                    <MenuItem key={exp.id} value={String(exp.id)}>
                      {exp.name} ({exp.total_measurements} measurements)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip 
                  label={`${mutationData.reduce((sum: number, d: MutationDataItem) => sum + d.count, 0)} measurements`} 
                  color="primary" 
                  variant="outlined" 
                />
                <Chip 
                  label={`${mutationData.length} mutation types`} 
                  color="default" 
                  variant="outlined" 
                />
                {selectedExperiment === 'all' && correlationData && (
                  <Chip 
                    label={`r = ${correlationData.correlation_coefficient?.toFixed(3) || 'N/A'}`} 
                    color="info" 
                    variant="outlined" 
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </Card>
      )}

      {measurementsLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Tab Content */}
      {activeTab === 0 && !measurementsLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Grid container spacing={3}>
            {/* Energy Over Time */}
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Energy Consumption Over Time
                  </Typography>
                  {timeData.length > 0 ? (
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer>
                        <LineChart data={timeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="time" stroke={chartAxisColor} />
                          <YAxis stroke={chartAxisColor} />
                          <RechartsTooltip
                            contentStyle={chartTooltipStyle}
                            labelStyle={chartTooltipLabelStyle}
                            itemStyle={chartTooltipItemStyle}
                            formatter={(value: number) => [`${value.toFixed(2)} J`, 'Energy']}
                          />
                          <Line type="monotone" dataKey="energy" stroke="#6366f1" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Alert severity="info">No measurement data available for this experiment</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Distribution Pie Chart */}
            <Grid item xs={12} lg={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Measurement Distribution
                  </Typography>
                  {pecDistribution.length > 0 ? (
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={pecDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${percent}%`}
                            labelLine={false}
                          >
                            {pecDistribution.map((_: PecDistributionItem, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Alert severity="info">No measurement data available for this experiment</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Mutation Comparison */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Energy by Mutation Type
                  </Typography>
                  {mutationData.length > 0 ? (
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer>
                        <BarChart data={mutationData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis type="number" stroke={chartAxisColor} />
                          <YAxis dataKey="mutation" type="category" width={120} stroke={chartAxisColor} tick={{ fontSize: 12 }} />
                          <RechartsTooltip 
                            contentStyle={chartTooltipStyle}
                            labelStyle={chartTooltipLabelStyle}
                            itemStyle={chartTooltipItemStyle}
                            formatter={(value: number, name: string) => [
                              name === 'avgEnergy' ? `${value.toFixed(2)} J` : value,
                              name === 'avgEnergy' ? 'Avg Energy' : name
                            ]}
                          />
                          <Bar dataKey="avgEnergy" fill="#6366f1" radius={[0, 4, 4, 0]}>
                            {mutationData.map((entry: MutationDataItem, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Alert severity="info">No measurement data available for this experiment</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Radar Chart */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Baseline Profile
                  </Typography>
                  {radarData.length > 0 ? (
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                          <PolarAngleAxis dataKey="dimension" stroke={chartAxisColor} />
                          <PolarRadiusAxis stroke={chartAxisColor} />
                          <Radar name="Baseline (% of max)" dataKey="baseline" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                          <Legend />
                          <RechartsTooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Alert severity="info">Need at least 2 mutation types with measurement data for this experiment</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Scatter Plot */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Tokens vs Energy
                  </Typography>
                  {scatterData.length > 0 ? (
                    <Box sx={{ height: 350 }}>
                      <ResponsiveContainer>
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis
                            dataKey="tokens"
                            name="Tokens"
                            stroke={chartAxisColor}
                            label={{ value: 'Output Tokens', position: 'bottom', fill: chartAxisColor }}
                          />
                          <YAxis
                            dataKey="energy"
                            name="Energy"
                            stroke={chartAxisColor}
                            label={{ value: 'Energy (J)', angle: -90, position: 'insideLeft', fill: chartAxisColor }}
                          />
                          <RechartsTooltip
                            contentStyle={chartTooltipStyle}
                            labelStyle={chartTooltipLabelStyle}
                            itemStyle={chartTooltipItemStyle}
                            formatter={(value: number, name: string) => [
                              name === 'energy' ? `${value.toFixed(2)} J` : value,
                              name
                            ]}
                          />
                          <Scatter data={scatterData} fill="#6366f1">
                            {scatterData.map((_: ScatterDataItem, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.7} />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Alert severity="info">No measurement data available for this experiment</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </motion.div>
      )}

      {activeTab === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <StatisticalSignificance />
        </motion.div>
      )}

      {activeTab === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <LiveMonitor />
        </motion.div>
      )}

      {activeTab === 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Energy Heatmap by Mutation Type
                  </Typography>
                  {mutationData.length > 0 ? (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 400, p: 2 }}>
                        {mutationData.map((row: MutationDataItem, i: number) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography sx={{ width: 150, fontSize: '0.875rem' }}>{row.mutation}</Typography>
                            <Box
                              sx={{
                                flex: 1,
                                height: 40,
                                borderRadius: 1,
                                background: `linear-gradient(90deg, 
                                  rgba(99, 102, 241, ${0.3 + (row.avgEnergy / 100) * 0.7}) 0%, 
                                  rgba(239, 68, 68, ${0.3 + (row.avgEnergy / 100) * 0.7}) 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Typography variant="body2" fontWeight={600} color="white">
                                {row.avgEnergy.toFixed(2)} J
                              </Typography>
                            </Box>
                            {row.changePercent !== undefined && row.changePercent !== 0 && (
                              <Chip
                                label={`${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(1)}%`}
                                size="small"
                                color={row.changePercent > 0 ? 'error' : 'success'}
                                sx={{ minWidth: 70 }}
                              />
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <Alert severity="info">No data available. Select an experiment to view the heatmap.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Correlation Matrix
                  </Typography>
                  {selectedExperiment === 'all' ? (
                    <Alert severity="info">
                      Select a specific experiment above to view its real correlation matrix
                      (the underlying statistic requires one experiment's measurements, not an
                      aggregate across all of them).
                    </Alert>
                  ) : correlationMatrixLoading ? (
                    <Box display="flex" justifyContent="center" py={4}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : correlationMatrix?.variables?.length ? (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Spearman correlation, n={correlationMatrix.n_samples} measurements. Real data
                        from GET /analysis/experiment/{'{'}id{'}'}/correlations.
                      </Typography>
                      <Grid container spacing={1} sx={{ minWidth: 560 }}>
                        {correlationMatrix.variables.map((row: string, i: number) => (
                          <Grid item xs={12} key={row}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Typography sx={{ width: 140, fontWeight: 600, fontSize: '0.8rem' }}>
                                {row.replace(/_/g, ' ')}
                              </Typography>
                              {correlationMatrix.variables.map((col: string, j: number) => {
                                const correlation = correlationMatrix.correlation_matrix[i][j];
                                return (
                                  <Box
                                    key={col}
                                    title={`${row} vs ${col}: r=${correlation.toFixed(3)}`}
                                    sx={{
                                      flex: 1,
                                      height: 50,
                                      borderRadius: 1,
                                      bgcolor: correlation > 0
                                        ? `rgba(99, 102, 241, ${Math.abs(correlation)})`
                                        : `rgba(239, 68, 68, ${Math.abs(correlation)})`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Typography variant="body2" fontWeight={600} color="white">
                                      {correlation.toFixed(2)}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  ) : (
                    <Alert severity="info">Not enough measurement data in this experiment to compute a correlation matrix</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </motion.div>
      )}
    </Box>
  );
};

export default Visualizations;
