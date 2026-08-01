import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  alpha,
} from '@mui/material';
import { Insights as InsightsIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { analysisApi, experimentsApi, measurementsApi, Measurement } from '../services/api';

// This page was previously 100% fabricated -- fixed data arrays and
// Math.random() calls presenting invented statistics (PEC=0.89,
// F(4,1205)=156.8, per-model comparisons this app never ran, a
// "Correlation Matrix" and time series that re-randomized on every
// render) as if they were real findings. Everything below is now pulled
// from the real backend, following the same pattern as Analysis.tsx.

const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatFixed = (value: unknown, digits = 3, fallback = 'Unavailable') =>
  hasNumber(value) ? value.toFixed(digits) : fallback;

const formatScientific = (value: unknown, digits = 2, fallback = 'Unavailable') =>
  hasNumber(value) ? value.toExponential(digits) : fallback;

const prettifyMutationName = (value: string | undefined) =>
  (value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SOURCE_LABELS: Record<string, { label: string; color: 'success' | 'warning' | 'default' }> = {
  nvml_real: { label: 'Real GPU (NVML)', color: 'success' },
  tdp_proxy: { label: 'TDP proxy estimate', color: 'warning' },
  synthetic_simulation: { label: 'Synthetic simulation', color: 'default' },
};

const StatCard: React.FC<{ title: string; value: string; subtitle?: string; color?: string }> = ({
  title, value, subtitle, color = '#8b5cf6',
}) => (
  <motion.div whileHover={{ scale: 1.02, y: -4 }}>
    <Card sx={{ background: `linear-gradient(135deg, ${alpha(color, 0.12)} 0%, transparent 100%)`, borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.1em' }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, my: 1, color }}>
          {value}
        </Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  </motion.div>
);

const Findings: React.FC = () => {
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(null);

  const { data: experiments, isLoading: experimentsLoading } = useQuery({
    queryKey: ['experiments-findings'],
    queryFn: () => experimentsApi.list(1, 100, 'completed').then((res) => res.data),
  });

  const experimentList = experiments?.experiments || [];

  const preferredExperimentId = useMemo(() => {
    const list = experiments?.experiments || [];
    if (list.length === 0) return null;
    const withData = list.find((exp: any) => (exp.total_measurements || 0) >= 10);
    return (withData || list[0]).id as number;
  }, [experiments]);

  useEffect(() => {
    if (!selectedExperiment && preferredExperimentId) {
      setSelectedExperiment(preferredExperimentId);
    }
  }, [selectedExperiment, preferredExperimentId]);

  const { data: analysisResult, isLoading: analysisLoading } = useQuery({
    queryKey: ['findings-analysis', selectedExperiment],
    queryFn: () => analysisApi.getFullReport(selectedExperiment!).then((res) => res.data),
    enabled: !!selectedExperiment,
  });

  const { data: measurements } = useQuery({
    queryKey: ['findings-measurements', selectedExperiment],
    queryFn: () => measurementsApi.listForExperiment(selectedExperiment!, false).then((res) => res.data),
    enabled: !!selectedExperiment,
  });

  // Real provenance breakdown for the selected experiment -- lets a
  // visitor see immediately whether these numbers come from real
  // hardware, a proxy estimate, or the explicit synthetic fallback,
  // rather than presenting all three as equally "real" the way the old
  // fabricated page implicitly did.
  const sourceCounts = useMemo(() => {
    const rows = (measurements || []) as Measurement[];
    const counts: Record<string, number> = {};
    for (const m of rows) {
      const key = m.measurement_source || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [measurements]);

  const totalWithSource = Object.values(sourceCounts).reduce((a, b) => a + b, 0);
  const mostlySynthetic = totalWithSource > 0 && (sourceCounts['synthetic_simulation'] || 0) / totalWithSource > 0.5;

  const pecAnalysis = analysisResult?.pec_analysis as any;
  const anovaAnalysis = analysisResult?.anova_analysis as any;
  const pecAvailable = hasNumber(pecAnalysis?.pec_score);

  const topEffect = useMemo(() => {
    const effects = (analysisResult?.effect_sizes || []) as any[];
    if (effects.length === 0) return null;
    return effects.reduce((best, e) =>
      Math.abs(e.cohens_d ?? 0) > Math.abs(best.cohens_d ?? 0) ? e : best
    );
  }, [analysisResult]);

  return (
    <Box>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Research Findings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real statistics from a completed experiment's measurements -- every number below is
            fetched from the backend, with an honest "Unavailable" wherever there isn't enough
            data. See the <em>Research Overview</em> page for what these metrics mean and how
            they're computed.
          </Typography>
        </Box>
      </motion.div>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl sx={{ minWidth: 320 }}>
            <InputLabel>Select Experiment</InputLabel>
            <Select
              value={selectedExperiment || ''}
              label="Select Experiment"
              onChange={(e) => setSelectedExperiment(e.target.value as number)}
            >
              {experimentList.map((exp: any) => (
                <MenuItem key={exp.id} value={exp.id}>
                  {exp.name} ({exp.total_measurements} measurements)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {experimentsLoading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : experimentList.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <InsightsIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>No completed experiments yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Run an experiment from the Experiments page to see real findings here.
            </Typography>
          </CardContent>
        </Card>
      ) : !selectedExperiment || analysisLoading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
        <>
          {totalWithSource > 0 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Data provenance:</Typography>
              {Object.entries(sourceCounts).map(([source, count]) => {
                const meta = SOURCE_LABELS[source] || { label: source, color: 'default' as const };
                return (
                  <Chip key={source} size="small" color={meta.color} label={`${meta.label}: ${count}`} />
                );
              })}
            </Box>
          )}

          {mostlySynthetic && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Most measurements in this experiment used the synthetic simulation fallback (no
              real model or hardware) -- treat any correlation/effect-size below as illustrative
              of the pipeline, not a validated real-world result.
            </Alert>
          )}

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="PEC (SII-EPT correlation)"
                value={pecAvailable ? formatFixed(pecAnalysis.pec_score) : 'Unavailable'}
                subtitle={pecAvailable ? `p = ${formatScientific(pecAnalysis.p_value)}` : 'Insufficient annotated data'}
                color="#8b5cf6"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="ANOVA (mutation type)"
                value={hasNumber(anovaAnalysis?.anova?.f_statistic) ? `F = ${formatFixed(anovaAnalysis.anova.f_statistic, 2)}` : 'Unavailable'}
                subtitle={hasNumber(anovaAnalysis?.anova?.p_value) ? `p = ${formatScientific(anovaAnalysis.anova.p_value)}` : undefined}
                color="#06b6d4"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Largest effect size"
                value={topEffect ? `d = ${formatFixed(topEffect.cohens_d, 2)}` : 'Unavailable'}
                subtitle={topEffect ? prettifyMutationName(topEffect.comparison) : 'No pairwise comparisons yet'}
                color="#ec4899"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Measurements"
                value={String(analysisResult?.experiment?.total_measurements || 0)}
                subtitle="Valid, non-warmup rows"
                color="#10b981"
              />
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Interpretation</Typography>
              <Typography variant="body2" color="text.secondary">
                {pecAnalysis?.interpretation || 'Run the analysis for this experiment to generate an interpretation.'}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>All completed experiments</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Experiment</TableCell>
                      <TableCell align="right">Measurements</TableCell>
                      <TableCell align="right">PEC score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {experimentList.map((exp: any) => (
                      <TableRow
                        key={exp.id}
                        hover
                        selected={exp.id === selectedExperiment}
                        onClick={() => setSelectedExperiment(exp.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{exp.name}</TableCell>
                        <TableCell align="right">{exp.total_measurements}</TableCell>
                        <TableCell align="right">{hasNumber(exp.pec_score) ? exp.pec_score.toFixed(3) : 'Unavailable'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default Findings;
