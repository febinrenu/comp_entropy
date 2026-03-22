import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  LinearProgress,
  Divider,
  Alert,
} from '@mui/material';
import { motion } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';

interface StatisticalResult {
  id: string;
  testName: string;
  comparison: string;
  statistic: number;
  pValue: number;
  effectSize: number;
  effectInterpretation: string;
  sampleSize: number;
  power: number;
  ciLower: number;
  ciUpper: number;
  isSignificant: boolean;
  notes: string;
}

const mockResults: StatisticalResult[] = [
  {
    id: '1',
    testName: 'Two-Sample t-Test',
    comparison: 'Baseline vs Synonym Replacement',
    statistic: 3.45,
    pValue: 0.0012,
    effectSize: 0.72,
    effectInterpretation: 'Medium',
    sampleSize: 100,
    power: 0.89,
    ciLower: 0.15,
    ciUpper: 0.45,
    isSignificant: true,
    notes: 'Significant difference in energy consumption',
  },
  {
    id: '2',
    testName: 'Mann-Whitney U',
    comparison: 'Baseline vs Paraphrase',
    statistic: 2856,
    pValue: 0.0034,
    effectSize: 0.58,
    effectInterpretation: 'Medium',
    sampleSize: 100,
    power: 0.82,
    ciLower: 0.12,
    ciUpper: 0.38,
    isSignificant: true,
    notes: 'Non-parametric test confirms difference',
  },
  {
    id: '3',
    testName: 'ANOVA',
    comparison: 'All Mutation Types',
    statistic: 5.67,
    pValue: 0.0001,
    effectSize: 0.23,
    effectInterpretation: 'Small',
    sampleSize: 500,
    power: 0.95,
    ciLower: -0.05,
    ciUpper: 0.35,
    isSignificant: true,
    notes: 'Significant variation across mutation types',
  },
  {
    id: '4',
    testName: 'Paired t-Test',
    comparison: 'Pre vs Post Simplification',
    statistic: 1.23,
    pValue: 0.22,
    effectSize: 0.15,
    effectInterpretation: 'Small',
    sampleSize: 50,
    power: 0.45,
    ciLower: -0.08,
    ciUpper: 0.28,
    isSignificant: false,
    notes: 'No significant difference detected',
  },
  {
    id: '5',
    testName: "Pearson's r",
    comparison: 'Word Count vs Energy',
    statistic: 0.67,
    pValue: 0.0001,
    effectSize: 0.67,
    effectInterpretation: 'Large',
    sampleSize: 200,
    power: 0.99,
    ciLower: 0.55,
    ciUpper: 0.76,
    isSignificant: true,
    notes: 'Strong positive correlation',
  },
  {
    id: '6',
    testName: 'Chi-Square',
    comparison: 'Mutation Success Rate',
    statistic: 15.8,
    pValue: 0.0027,
    effectSize: 0.28,
    effectInterpretation: 'Small',
    sampleSize: 200,
    power: 0.78,
    ciLower: 0.15,
    ciUpper: 0.41,
    isSignificant: true,
    notes: 'Mutation type affects success rate',
  },
];

const effectSizeColors: Record<string, string> = {
  Small: '#ffd93d',
  Medium: '#ff9f43',
  Large: '#ee5a24',
};

const StatisticalSignificance: React.FC = () => {
  const [selectedTest, setSelectedTest] = useState<string>('all');
  const [alphaLevel, setAlphaLevel] = useState<number>(0.05);

  const filteredResults = selectedTest === 'all'
    ? mockResults
    : mockResults.filter((r) => r.testName === selectedTest);

  const significantCount = filteredResults.filter((r) => r.isSignificant).length;
  const avgPower = filteredResults.reduce((sum, r) => sum + r.power, 0) / filteredResults.length;
  const avgEffectSize = filteredResults.reduce((sum, r) => sum + r.effectSize, 0) / filteredResults.length;

  const exportResults = () => {
    const csvContent = [
      ['Test', 'Comparison', 'Statistic', 'p-value', 'Effect Size', 'Interpretation', 'Significant'].join(','),
      ...filteredResults.map((r) =>
        [r.testName, r.comparison, r.statistic, r.pValue, r.effectSize, r.effectInterpretation, r.isSignificant].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statistical_results.csv';
    a.click();
  };

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              📊 Statistical Significance Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comprehensive statistical testing for computational entropy experiments
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportResults}
          >
            Export CSV
          </Button>
        </Box>
      </motion.div>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card sx={{ background: 'linear-gradient(135deg, #667eea20 0%, transparent 100%)' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Tests Performed
                </Typography>
                <Typography variant="h3" fontWeight={700} color="primary">
                  {filteredResults.length}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card sx={{ background: 'linear-gradient(135deg, #6bcb7720 0%, transparent 100%)' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Significant Results
                </Typography>
                <Typography variant="h3" fontWeight={700} color="success.main">
                  {significantCount}/{filteredResults.length}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card sx={{ background: 'linear-gradient(135deg, #ff9f4320 0%, transparent 100%)' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Avg. Effect Size
                </Typography>
                <Typography variant="h3" fontWeight={700} color="warning.main">
                  {avgEffectSize.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card sx={{ background: 'linear-gradient(135deg, #4d96ff20 0%, transparent 100%)' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Avg. Statistical Power
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h3" fontWeight={700} color="info.main">
                    {(avgPower * 100).toFixed(0)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Test Type</InputLabel>
                <Select
                  value={selectedTest}
                  onChange={(e) => setSelectedTest(e.target.value)}
                  label="Test Type"
                >
                  <MenuItem value="all">All Tests</MenuItem>
                  <MenuItem value="Two-Sample t-Test">Two-Sample t-Test</MenuItem>
                  <MenuItem value="Mann-Whitney U">Mann-Whitney U</MenuItem>
                  <MenuItem value="ANOVA">ANOVA</MenuItem>
                  <MenuItem value="Paired t-Test">Paired t-Test</MenuItem>
                  <MenuItem value="Pearson's r">Pearson's r</MenuItem>
                  <MenuItem value="Chi-Square">Chi-Square</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Alpha Level</InputLabel>
                <Select
                  value={alphaLevel}
                  onChange={(e) => setAlphaLevel(e.target.value as number)}
                  label="Alpha Level"
                >
                  <MenuItem value={0.01}>α = 0.01 (99% confidence)</MenuItem>
                  <MenuItem value={0.05}>α = 0.05 (95% confidence)</MenuItem>
                  <MenuItem value={0.1}>α = 0.10 (90% confidence)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Alert severity="info" sx={{ py: 0 }}>
                <Typography variant="caption">
                  Using Bonferroni correction for multiple comparisons
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Test</TableCell>
                <TableCell>Comparison</TableCell>
                <TableCell align="right">Statistic</TableCell>
                <TableCell align="right">p-value</TableCell>
                <TableCell align="center">Effect Size</TableCell>
                <TableCell align="right">Power</TableCell>
                <TableCell>95% CI</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredResults.map((result, index) => (
                <TableRow
                  key={result.id}
                  sx={{
                    bgcolor: result.isSignificant ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <TableCell>
                    {result.isSignificant ? (
                      <Tooltip title="Statistically significant">
                        <CheckCircleIcon color="success" />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Not significant">
                        <CancelIcon color="disabled" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {result.testName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{result.comparison}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      n = {result.sampleSize}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace">
                      {result.statistic.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={result.pValue < 0.001 ? '< 0.001' : result.pValue.toFixed(4)}
                      size="small"
                      color={result.pValue < alphaLevel ? 'success' : 'default'}
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" gap={1} justifyContent="center">
                      <Typography variant="body2" fontFamily="monospace">
                        {result.effectSize.toFixed(2)}
                      </Typography>
                      <Chip
                        label={result.effectInterpretation}
                        size="small"
                        sx={{
                          bgcolor: effectSizeColors[result.effectInterpretation],
                          color: 'black',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ minWidth: 60 }}>
                      <Typography variant="body2" fontFamily="monospace">
                        {(result.power * 100).toFixed(0)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={result.power * 100}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'grey.800',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: result.power >= 0.8 ? 'success.main' : 'warning.main',
                          },
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      [{result.ciLower.toFixed(2)}, {result.ciUpper.toFixed(2)}]
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Interpretation Guide */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            📖 Interpretation Guide
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Effect Size (Cohen's d)
              </Typography>
              <Box display="flex" flexDirection="column" gap={0.5}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#ffd93d' }} />
                  <Typography variant="body2">Small: d = 0.2</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#ff9f43' }} />
                  <Typography variant="body2">Medium: d = 0.5</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#ee5a24' }} />
                  <Typography variant="body2">Large: d = 0.8</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Statistical Power
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The probability of detecting a true effect. Power ≥ 0.80 (80%) is considered adequate.
                Low power increases the risk of Type II errors (false negatives).
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Confidence Interval
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The range within which the true population parameter likely falls.
                If the CI doesn't include 0, the effect is statistically significant.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StatisticalSignificance;
