import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Assessment as AnalysisIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { analysisApi, experimentsApi, measurementsApi, Measurement } from '../services/api';

const mutationColors: Record<string, string> = {
  baseline: '#8b5cf6',
  noise_typo: '#ef4444',
  noise_verbose: '#f59e0b',
  ambiguity_semantic: '#10b981',
  ambiguity_contradiction: '#06b6d4',
  negation: '#f43f5e',
  reordering: '#ec4899',
  formality_shift: '#14b8a6',
  code_switching: '#f97316',
};

const mutationStabilityProxy: Record<string, number> = {
  baseline: 1.0,
  noise_typo: 0.82,
  noise_verbose: 0.72,
  ambiguity_semantic: 0.48,
  ambiguity_contradiction: 0.3,
  negation: 0.55,
  reordering: 0.62,
  formality_shift: 0.68,
  code_switching: 0.58,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatFixed = (value: unknown, digits = 4, fallback = 'Unavailable') =>
  hasNumber(value) ? value.toFixed(digits) : fallback;

const formatScientific = (value: unknown, digits = 2, fallback = 'Unavailable') =>
  hasNumber(value) ? value.toExponential(digits) : fallback;

const parseComparisonMutation = (comparison: string | undefined): string => {
  if (!comparison) return 'unknown';
  const normalized = comparison.toLowerCase().trim();
  const parts = normalized.includes('_vs_')
    ? normalized.split('_vs_')
    : normalized.split(/\s+vs\.?\s+/);
  if (parts.length < 2) return normalized.replace(/\s+/g, '_');
  const [left, right] = parts.map((p) => p.replace(/\s+/g, '_').trim());
  return left.includes('baseline') ? right : left;
};

const prettifyMutationName = (value: string | undefined) =>
  (value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}> = ({ title, value, subtitle, color = '#8b5cf6' }) => (
  <motion.div whileHover={{ scale: 1.02, y: -4 }}>
    <Card
      sx={{
        background: `linear-gradient(135deg, ${alpha(color, 0.12)} 0%, transparent 100%)`,
        borderLeft: `4px solid ${color}`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100px',
          height: '100px',
          background: `radial-gradient(circle, ${alpha(color, 0.2)} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.1em' }}>
          {title}
        </Typography>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            my: 1,
            background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {value}
        </Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  </motion.div>
);

const Analysis: React.FC = () => {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const { data: experiments } = useQuery({
    queryKey: ['experiments-list'],
    queryFn: () => experimentsApi.list(1, 100, 'completed').then((res) => res.data),
  });

  const preferredExperimentId = useMemo(() => {
    const list = experiments?.experiments || [];
    if (list.length === 0) return null;
    const withEnoughData = list.find((exp: any) => (exp.total_measurements || 0) >= 10);
    if (withEnoughData) return withEnoughData.id as number;
    return list[0].id as number;
  }, [experiments]);

  useEffect(() => {
    if (!selectedExperiment && preferredExperimentId) {
      setSelectedExperiment(preferredExperimentId);
    }
  }, [selectedExperiment, preferredExperimentId]);

  const { data: analysisResult, isLoading: analysisLoading } = useQuery({
    queryKey: ['analysis', selectedExperiment],
    queryFn: () => analysisApi.getFullReport(selectedExperiment!).then((res) => res.data),
    enabled: !!selectedExperiment,
  });

  const { data: measurementData } = useQuery({
    queryKey: ['analysis-measurements', selectedExperiment],
    queryFn: () => measurementsApi.listForExperiment(selectedExperiment!, false).then((res) => res.data),
    enabled: !!selectedExperiment,
  });

  const runAnalysisMutation = useMutation({
    mutationFn: () => analysisApi.runAnalysis(selectedExperiment!),
    onSuccess: () => {
      toast.success('Analysis completed');
      queryClient.invalidateQueries({ queryKey: ['analysis', selectedExperiment] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Analysis failed');
    },
  });

  const pecAnalysis = analysisResult?.pec_analysis as any;
  const anovaAnalysis = analysisResult?.anova_analysis as any;
  const pecAvailable = hasNumber(pecAnalysis?.pec_score);
  const pecError = !pecAvailable ? pecAnalysis?.error : null;

  const primaryPValue = hasNumber(pecAnalysis?.p_value)
    ? pecAnalysis.p_value
    : hasNumber(anovaAnalysis?.anova?.p_value)
      ? anovaAnalysis.anova.p_value
      : null;

  const effectSizeData = analysisResult?.effect_sizes
    ? analysisResult.effect_sizes.map((item: any) => {
        const mutationKey = parseComparisonMutation(item.comparison);
        return {
          mutation: prettifyMutationName(mutationKey),
          effectSize: hasNumber(item.cohens_d) ? item.cohens_d : 0,
          color: mutationColors[mutationKey] || '#64748b',
        };
      })
    : [];

  const scatterData = useMemo(() => {
    const rows = (measurementData || []) as Measurement[];
    return rows
      .map((m) => {
        const mutationType = m.prompt?.mutation_type || 'baseline';
        const stability =
          m.prompt?.stability_score ??
          (hasNumber(m.prompt?.semantic_instability_index)
            ? Math.max(0, Math.min(1, 1 - (m.prompt?.semantic_instability_index as number) / 5))
            : mutationStabilityProxy[mutationType] ?? 0.5);
        const energy =
          m.energy_per_token_mj ??
          ((m.total_energy_joules ?? m.energy_joules ?? 0) * 1000);
        return { stability, energy, mutationType };
      })
      .filter((point) => hasNumber(point.stability) && hasNumber(point.energy));
  }, [measurementData]);

  const gridColor = alpha(theme.palette.divider, 0.4);
  const axisColor = theme.palette.text.secondary;
  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    borderRadius: 8,
    color: theme.palette.text.primary,
    boxShadow: isDark ? '0 10px 28px rgba(0,0,0,0.45)' : '0 10px 28px rgba(15,23,42,0.12)',
  } as const;
  const tooltipLabelStyle = { color: theme.palette.text.primary, fontWeight: 600 };
  const tooltipItemStyle = { color: theme.palette.text.primary };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <Box
        sx={{
          mb: 5,
          p: 4,
          borderRadius: 4,
          background: isDark
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(236, 72, 153, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.05) 50%, rgba(236, 72, 153, 0.03) 100%)',
          border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.15)'}`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <AnalysisIcon sx={{ fontSize: 34, color: '#06b6d4' }} />
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Analysis
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Statistical analysis and research findings with publication-ready metrics
            </Typography>
          </Box>
          {selectedExperiment && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => runAnalysisMutation.mutate()}
                disabled={runAnalysisMutation.isPending}
              >
                {runAnalysisMutation.isPending ? 'Analyzing...' : 'Re-run Analysis'}
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => window.open(`http://localhost:8000/api/export/experiment/${selectedExperiment}/latex`, '_blank')}
              >
                Export Report
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      <motion.div variants={itemVariants}>
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <FormControl sx={{ minWidth: 320 }}>
              <InputLabel>Select Experiment</InputLabel>
              <Select
                value={selectedExperiment || ''}
                label="Select Experiment"
                onChange={(e) => setSelectedExperiment(e.target.value as number)}
              >
                {experiments?.experiments?.map((exp: any) => (
                  <MenuItem key={exp.id} value={exp.id}>
                    {exp.name} ({exp.total_measurements} measurements)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      </motion.div>

      {!selectedExperiment ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">Select an experiment to view analysis</Typography>
          </CardContent>
        </Card>
      ) : analysisLoading ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Loading analysis results...</Typography>
          </CardContent>
        </Card>
      ) : !analysisResult ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>No analysis results found</Typography>
            <Button variant="contained" onClick={() => runAnalysisMutation.mutate()} disabled={runAnalysisMutation.isPending}>
              Run Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert severity={pecAvailable ? 'success' : 'warning'} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600}>Key Finding: Prompt Entropy Coefficient (PEC)</Typography>
            <Typography variant="body2">
              {pecAvailable ? (
                <>
                  The analysis reveals a <strong>PEC score of {formatFixed(pecAnalysis?.pec_score, 4)}</strong>,
                  indicating {pecAnalysis.pec_score > 0.5 ? 'strong' : 'moderate'} correlation between
                  prompt instability and computational energy consumption.
                </>
              ) : (
                <>
                  PEC is unavailable for this experiment because semantic instability values are missing.
                  {pecError ? ` (${pecError})` : ''} Run prompt validation or select an experiment with richer annotations.
                </>
              )}
            </Typography>
          </Alert>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="PEC Score" value={pecAvailable ? formatFixed(pecAnalysis?.pec_score, 4) : 'Unavailable'} subtitle="Prompt Entropy Coefficient" color="#8b5cf6" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="P-Value"
                value={formatScientific(primaryPValue, 2)}
                subtitle={
                  hasNumber(primaryPValue)
                    ? primaryPValue < 0.05
                      ? 'Significant (p < 0.05)'
                      : 'Not Significant'
                    : 'Not Available'
                }
                color={hasNumber(primaryPValue) && primaryPValue < 0.05 ? '#10b981' : '#f59e0b'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Sample Size" value={String(analysisResult?.experiment?.total_measurements || 0)} subtitle="Valid measurements" color="#ec4899" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Eta Squared" value={formatFixed(anovaAnalysis?.effect_sizes?.eta_squared, 4)} subtitle="ANOVA effect size" color="#06b6d4" />
            </Grid>
          </Grid>

          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab label="Visualizations" />
                <Tab label="ANOVA Results" />
                <Tab label="Effect Sizes" />
                <Tab label="Recommendations" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>PEC Correlation Plot</Typography>
                    <Box sx={{ height: 350 }}>
                      <ResponsiveContainer>
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis
                            dataKey="stability"
                            stroke={axisColor}
                            name="Stability"
                            domain={[0, 1]}
                            label={{ value: 'Stability Score', position: 'bottom', fill: axisColor }}
                          />
                          <YAxis
                            dataKey="energy"
                            stroke={axisColor}
                            label={{ value: 'Energy (mJ/token)', angle: -90, position: 'insideLeft', fill: axisColor }}
                          />
                          <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                          <Scatter data={scatterData} fill="#6366f1" opacity={0.65} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Effect Size by Mutation Type</Typography>
                    <Box sx={{ height: 350 }}>
                      <ResponsiveContainer>
                        <BarChart data={effectSizeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="mutation" stroke={axisColor} />
                          <YAxis stroke={axisColor} />
                          <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                          <Bar dataKey="effectSize" name="Effect Size">
                            {effectSizeData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>One-Way ANOVA Results (Mutation Types)</Typography>
                {analysisResult?.anova_analysis ? (
                  <>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Metric</TableCell>
                            <TableCell align="right">Value</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>F-Statistic</TableCell>
                            <TableCell align="right">{formatFixed(analysisResult?.anova_analysis?.anova?.f_statistic, 4)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>P-Value</TableCell>
                            <TableCell align="right">
                              <Chip
                                size="small"
                                label={formatScientific(analysisResult?.anova_analysis?.anova?.p_value, 2)}
                                color={analysisResult?.anova_analysis?.anova?.is_significant ? 'success' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Eta Squared</TableCell>
                            <TableCell align="right">{formatFixed(analysisResult?.anova_analysis?.effect_sizes?.eta_squared, 4)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* ANOVA Interpretation */}
                    {analysisResult?.anova_analysis?.anova_interpretation && (
                      <Alert severity="info" sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Statistical Interpretation</Typography>
                        <Typography variant="body2">{analysisResult.anova_analysis.anova_interpretation}</Typography>
                      </Alert>
                    )}

                    {/* Effect Size Meaning */}
                    {analysisResult?.anova_analysis?.effect_meaning && (
                      <Paper sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.success.main, 0.08), border: `1px solid ${alpha(theme.palette.success.main, 0.3)}` }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>Effect Size Impact</Typography>
                        <Typography variant="body2" color="text.secondary">{analysisResult.anova_analysis.effect_meaning}</Typography>
                      </Paper>
                    )}

                    {/* Statistical Notes */}
                    {analysisResult?.anova_analysis?.statistical_notes && (
                      <Paper sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>Understanding ANOVA</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>Test Used:</Typography>
                            <Typography variant="body2" color="text.secondary">{analysisResult.anova_analysis.statistical_notes.test_description}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>Null Hypothesis:</Typography>
                            <Typography variant="body2" color="text.secondary">{analysisResult.anova_analysis.statistical_notes.null_hypothesis}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>What F-Value Means:</Typography>
                            <Typography variant="body2" color="text.secondary">{analysisResult.anova_analysis.statistical_notes.f_value_meaning}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>P-Value Interpretation:</Typography>
                            <Typography variant="body2" color="text.secondary">{analysisResult.anova_analysis.statistical_notes.p_value_meaning}</Typography>
                          </Box>
                        </Box>
                      </Paper>
                    )}

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Group Means</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {analysisResult?.anova_analysis?.groups?.map((group: string, i: number) => {
                        const color = mutationColors[group] || theme.palette.text.secondary;
                        return (
                          <Chip
                            key={group}
                            label={`${prettifyMutationName(group)}: ${formatFixed(analysisResult?.anova_analysis?.group_means?.[i], 4)}`}
                            sx={{ bgcolor: alpha(color, 0.16), color }}
                          />
                        );
                      })}
                    </Box>
                  </>
                ) : (
                  <Alert severity="info">ANOVA results not available</Alert>
                )}
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Pairwise Effect Sizes (Cohen&apos;s d)</Typography>
                
                {/* Explanation Box */}
                <Alert severity="info" icon={false} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>What is Cohen's d?</Typography>
                  <Typography variant="body2">
                    Cohen's d measures the standardized difference between two groups. Values indicate:
                    <br />• <strong>d &lt; 0.2:</strong> Negligible effect
                    <br />• <strong>0.2 ≤ d &lt; 0.5:</strong> Small effect
                    <br />• <strong>0.5 ≤ d &lt; 0.8:</strong> Medium effect
                    <br />• <strong>d ≥ 0.8:</strong> Large effect (substantial practical significance)
                  </Typography>
                </Alert>

                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Comparison</TableCell>
                        <TableCell align="right">Cohen&apos;s d</TableCell>
                        <TableCell align="right">% Change</TableCell>
                        <TableCell>Interpretation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analysisResult?.effect_sizes?.map((effect: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{effect.comparison || 'N/A'}</TableCell>
                          <TableCell align="right">{formatFixed(effect.cohens_d, 4)}</TableCell>
                          <TableCell align="right">{hasNumber(effect.percent_change) ? `${effect.percent_change.toFixed(2)}%` : 'Unavailable'}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={effect.interpretation || 'N/A'}
                              color={effect.interpretation === 'large' ? 'error' : effect.interpretation === 'medium' ? 'warning' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Practical Meaning for Each Effect */}
                {analysisResult?.effect_sizes?.some((e: any) => e.practical_meaning) && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Practical Impact</Typography>
                    {analysisResult.effect_sizes
                      .filter((e: any) => e.practical_meaning)
                      .map((effect: any, i: number) => (
                        <Paper key={i} sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.warning.main, 0.06), border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: 'warning.dark' }}>
                            {effect.comparison}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {effect.practical_meaning}
                          </Typography>
                        </Paper>
                      ))}
                  </Box>
                )}
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Research Recommendations</Typography>
                {analysisResult?.recommendations && analysisResult?.recommendations.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {analysisResult?.recommendations?.map((rec: string, i: number) => (
                      <Alert key={i} severity="info" icon={false}>
                        <Typography variant="body2">{rec}</Typography>
                      </Alert>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info">No recommendations available yet. Run a full analysis to generate recommendations.</Alert>
                )}

                <Typography variant="h6" sx={{ mt: 4, mb: 2, fontWeight: 600 }}>PEC Analysis Interpretation</Typography>
                <Paper
                  sx={{
                    p: 2,
                    mb: 3,
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06),
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  }}
                >
                  <Typography variant="body2">
                    {analysisResult?.pec_analysis?.interpretation || 'Run analysis to see interpretation.'}
                  </Typography>
                </Paper>

                {/* Significance Explanation */}
                {analysisResult?.pec_analysis?.significance_explanation && (
                  <Paper sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.info.main, 0.08), border: `1px solid ${alpha(theme.palette.info.main, 0.3)}` }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'info.main' }}>Understanding the Statistics</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {analysisResult.pec_analysis.significance_explanation}
                    </Typography>
                  </Paper>
                )}

                {/* Statistical Notes */}
                {analysisResult?.pec_analysis?.statistical_notes && (
                  <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.secondary.main, 0.06) }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>About the PEC Test</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>Test Method:</Typography>
                        <Typography variant="body2" color="text.secondary">{analysisResult.pec_analysis.statistical_notes.test_used}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>Null Hypothesis:</Typography>
                        <Typography variant="body2" color="text.secondary">{analysisResult.pec_analysis.statistical_notes.null_hypothesis}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>Significance Level:</Typography>
                        <Typography variant="body2" color="text.secondary">{analysisResult.pec_analysis.statistical_notes.significance_level}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>What It Means:</Typography>
                        <Typography variant="body2" color="text.secondary">{analysisResult.pec_analysis.statistical_notes.what_it_means}</Typography>
                      </Box>
                    </Box>
                  </Paper>
                )}
              </CardContent>
            </TabPanel>
          </Card>
        </>
      )}
    </motion.div>
  );
};

export default Analysis;
