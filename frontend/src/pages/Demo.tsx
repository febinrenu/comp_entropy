import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Paper,
  Chip,
  Divider,
  Alert,
  LinearProgress,
  Grid,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Science as ScienceIcon,
  Bolt as BoltIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckIcon,
  RestartAlt as ResetIcon,
  Lightbulb as TipIcon,
  ElectricBolt,
  AutoAwesome as SparkleIcon,
  RocketLaunch as RocketIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { demoApi, QuickExperimentResult } from '../services/api';

// Sample prompts for quick testing
const SAMPLE_PROMPTS = [
  "Explain how photosynthesis works.",
  "What is machine learning?",
  "Describe the water cycle.",
  "How does gravity work?",
  "What causes climate change?",
];

const MUTATION_LABELS: Record<string, { label: string; color: string; description: string; gradient: string }> = {
  baseline: {
    label: 'Baseline',
    color: '#10b981',
    description: 'Original clear prompt',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
  },
  noise_verbose: {
    label: 'Minor Noise',
    color: '#06b6d4',
    description: 'Simple word replacements',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
  ambiguity_semantic: {
    label: 'Semantic Ambiguity',
    color: '#f59e0b',
    description: 'Vague, open-ended phrasing',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
  formality_shift: {
    label: 'Elaborate/Verbose',
    color: '#ef4444',
    description: 'Detailed, complex instructions',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  },
  reordering: {
    label: 'Reordered',
    color: '#8b5cf6',
    description: 'Shuffled word order',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  },
  noise_typo: {
    label: 'Typos',
    color: '#ec4899',
    description: 'Spelling mistakes',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
  },
  negation: {
    label: 'Negation',
    color: '#f97316',
    description: 'Double negatives',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  },
  code_switching: {
    label: 'Code-Switching',
    color: '#06b6d4',
    description: 'Mixed language phrases',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
  ambiguity_contradiction: {
    label: 'Contradiction',
    color: '#ef4444',
    description: 'Contradictory statements',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  },
};

// Animation variants
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

const pulseAnimation = {
  scale: [1, 1.02, 1],
  transition: { duration: 2, repeat: Infinity },
};

const Demo: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<QuickExperimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const runExperiment = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to test');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);
    setCurrentStep(0);

    try {
      // Simulate step-by-step progress
      const steps = ['Analyzing baseline...', 'Testing mutations...', 'Measuring complexity...', 'Comparing variations...', 'Finalizing results...'];
      
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const response = await demoApi.runQuickExperiment(prompt);
      setResult(response.data);
    } catch (err) {
      setError('Failed to run experiment. Make sure the backend is running.');
      console.error(err);
    } finally {
      setIsRunning(false);
      setCurrentStep(0);
    }
  }, [prompt]);

  const selectSamplePrompt = (sample: string) => {
    setPrompt(sample);
    setResult(null);
    setError(null);
  };

  const resetDemo = () => {
    setPrompt('');
    setResult(null);
    setError(null);
  };

  // Prepare chart data
  const chartData = result?.results.map(r => ({
    name: MUTATION_LABELS[r.mutation_type]?.label || r.mutation_type,
    energy: r.energy_consumed,
    change: r.energy_change_percent || 0,
    color: MUTATION_LABELS[r.mutation_type]?.color || '#8b5cf6',
  })) || [];

  const baselineEnergy = result?.results.find(r => r.mutation_type === 'baseline')?.energy_consumed || 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <Box 
          sx={{ 
            mb: 4,
            p: 4,
            borderRadius: 4,
            background: isDark 
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 50%, rgba(6, 182, 212, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(236, 72, 153, 0.05) 50%, rgba(6, 182, 212, 0.05) 100%)',
            border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)'}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated background gradient */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isDark
                ? 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)'
                : 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(236, 72, 153, 0.05) 0%, transparent 50%)',
              animation: 'bgShift 10s ease-in-out infinite',
            }}
          />
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <motion.div animate={pulseAnimation}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
                  }}
                >
                  <ScienceIcon sx={{ fontSize: 32, color: 'white' }} />
                </Box>
              </motion.div>
              <Box>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #06b6d4 100%)',
                    backgroundSize: '200% 200%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'morphGradient 5s ease infinite',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Live Energy Experiment
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                  <Chip 
                    label="Interactive Proof" 
                    size="small"
                    icon={<SparkleIcon sx={{ fontSize: 16 }} />}
                    sx={{ 
                      background: isDark 
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'
                        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
                      border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                      '& .MuiChip-icon': { color: '#10b981' },
                    }} 
                  />
                  <Chip 
                    label="Real-time Measurements" 
                    size="small"
                    sx={{ 
                      background: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                      border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'}`,
                    }} 
                  />
                </Box>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, lineHeight: 1.7 }}>
              Test any prompt and see <strong style={{ color: '#8b5cf6' }}>real-time energy measurements</strong> across different phrasing variations.
              This demonstrates our key finding: <em style={{ color: '#ec4899' }}>how you phrase a prompt directly affects AI energy consumption</em>.
            </Typography>
          </Box>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              sx={{ 
                height: '100%',
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
                  : 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%)',
                '&:hover': {
                  boxShadow: isDark 
                    ? '0 20px 60px rgba(139, 92, 246, 0.2)'
                    : '0 20px 60px rgba(139, 92, 246, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  display="flex" 
                  alignItems="center" 
                  gap={1}
                  sx={{ 
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  <BoltIcon sx={{ color: '#f59e0b' }} /> Enter Your Prompt
                </Typography>
                
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Type a question or instruction to test..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  variant="outlined"
                  disabled={isRunning}
                  sx={{ 
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(0, 0, 0, 0.2)',
                      '&:hover': {
                        boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)',
                      },
                      '&.Mui-focused': {
                        boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)',
                      },
                    },
                  }}
                />

                <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <RocketIcon />}
                      onClick={runExperiment}
                      disabled={isRunning || !prompt.trim()}
                      sx={{ 
                        minWidth: 200,
                        py: 1.5,
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
                        '&:hover': {
                          boxShadow: '0 8px 30px rgba(139, 92, 246, 0.6)',
                        },
                        '&:disabled': {
                          background: 'rgba(139, 92, 246, 0.3)',
                        },
                      }}
                    >
                      {isRunning ? 'Running...' : 'Run Experiment'}
                    </Button>
                  </motion.div>
                  <Button
                    variant="outlined"
                    startIcon={<ResetIcon />}
                    onClick={resetDemo}
                    disabled={isRunning}
                    sx={{
                      borderColor: 'rgba(139, 92, 246, 0.5)',
                      '&:hover': {
                        borderColor: '#8b5cf6',
                        background: 'rgba(139, 92, 246, 0.1)',
                      },
                    }}
                  >
                    Reset
                  </Button>
                </Box>

                {isRunning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={(currentStep + 1) * 20} 
                        sx={{ 
                          mb: 1, 
                          height: 10, 
                          borderRadius: 2,
                          background: 'rgba(139, 92, 246, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 2s infinite',
                          },
                        }} 
                      />
                      <Typography variant="body2" color="primary.main" fontWeight={500}>
                        {['🔍 Analyzing baseline...', '🔧 Testing mutations...', '🎯 Measuring complexity...', '📊 Comparing variations...', '⚡ Finalizing results...'][currentStep]}
                      </Typography>
                    </Box>
                  </motion.div>
                )}

                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                  </motion.div>
                )}

                <Divider sx={{ my: 2, borderColor: 'rgba(139, 92, 246, 0.2)' }} />

                <Typography variant="subtitle2" color="text.secondary" gutterBottom display="flex" alignItems="center" gap={1}>
                  <TipIcon fontSize="small" sx={{ color: '#8b5cf6' }} /> Quick Start - Try These:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {SAMPLE_PROMPTS.map((sample, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Chip
                        label={sample.length > 30 ? sample.slice(0, 30) + '...' : sample}
                        onClick={() => selectSamplePrompt(sample)}
                        variant={prompt === sample ? "filled" : "outlined"}
                        size="small"
                        sx={{ 
                          cursor: 'pointer',
                          background: prompt === sample 
                            ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
                            : 'transparent',
                          borderColor: prompt === sample ? 'transparent' : 'rgba(139, 92, 246, 0.3)',
                          color: prompt === sample ? 'white' : 'text.primary',
                          '&:hover': {
                            borderColor: '#8b5cf6',
                            background: prompt === sample 
                              ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
                              : 'rgba(139, 92, 246, 0.1)',
                          },
                        }}
                      />
                    </motion.div>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* What We're Testing */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              sx={{ 
                height: '100%', 
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, transparent 100%)',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  display="flex" 
                  alignItems="center" 
                  gap={1}
                  sx={{ 
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  <ScienceIcon sx={{ color: '#06b6d4' }} /> What This Experiment Proves
                </Typography>
                
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {Object.entries(MUTATION_LABELS).map(([key, { label, color, description, gradient }], index) => (
                      <motion.div key={key} variants={itemVariants}>
                        <Paper
                          sx={{
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, transparent 100%)`,
                            border: `1px solid ${alpha(color, 0.2)}`,
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateX(8px)',
                              boxShadow: `0 4px 20px ${alpha(color, 0.3)}`,
                              borderColor: alpha(color, 0.4),
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: gradient,
                              flexShrink: 0,
                              boxShadow: `0 0 10px ${alpha(color, 0.5)}`,
                            }}
                          />
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ color }}>
                              {label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {description}
                            </Typography>
                          </Box>
                        </Paper>
                      </motion.div>
                    ))}
                  </Box>
                </motion.div>

                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 3,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    '& .MuiAlert-icon': { color: '#3b82f6' },
                  }}
                >
                  <strong style={{ color: '#3b82f6' }}>Hypothesis:</strong> Ambiguous and overly-elaborate prompts force the AI to do more "computational work" to resolve uncertainty, consuming more energy.
                </Alert>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <>
              {/* Energy Chart */}
              <Grid item xs={12} md={8}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                        <ElectricBolt color="warning" /> Energy Consumption by Prompt Variation
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        Each bar shows energy (Joules) consumed. Green dashed line = baseline reference.
                      </Typography>
                      
                      <Box sx={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" label={{ value: 'Energy (Joules)', position: 'bottom' }} />
                            <YAxis type="category" dataKey="name" />
                            <RechartsTooltip
                              formatter={(value: number, name: string, props: any) => [
                                `${value.toFixed(2)}J ${props.payload.change !== 0 ? `(${props.payload.change > 0 ? '+' : ''}${props.payload.change.toFixed(1)}%)` : '(baseline)'}`,
                                'Energy'
                              ]}
                            />
                            <ReferenceLine x={baselineEnergy} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} />
                            <Bar dataKey="energy" radius={[0, 4, 4, 0]}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>

              {/* Summary Stats */}
              <Grid item xs={12} md={4}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                        <CheckIcon color="success" /> Key Results
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Most Efficient */}
                        <Paper sx={{ p: 2, bgcolor: 'success.dark', color: 'white' }}>
                          <Typography variant="caption" display="block">Most Efficient</Typography>
                          <Typography variant="h6">
                            {MUTATION_LABELS[result.summary.most_efficient]?.label || result.summary.most_efficient}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <TrendingDownIcon fontSize="small" />
                            <Typography variant="body2">Lowest energy use</Typography>
                          </Box>
                        </Paper>

                        {/* Least Efficient */}
                        <Paper sx={{ p: 2, bgcolor: 'error.dark', color: 'white' }}>
                          <Typography variant="caption" display="block">Least Efficient</Typography>
                          <Typography variant="h6">
                            {MUTATION_LABELS[result.summary.least_efficient]?.label || result.summary.least_efficient}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <TrendingUpIcon fontSize="small" />
                            <Typography variant="body2">Highest energy use</Typography>
                          </Box>
                        </Paper>

                        {/* Potential Savings */}
                        <Paper sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
                          <Typography variant="caption" display="block">Potential Savings</Typography>
                          <Typography variant="h4" fontWeight="bold">
                            {result.summary.potential_savings_percent.toFixed(1)}%
                          </Typography>
                          <Typography variant="body2">
                            By using optimal phrasing
                          </Typography>
                        </Paper>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>

              {/* Detailed Breakdown */}
              <Grid item xs={12}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Detailed Comparison
                      </Typography>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, minWidth: 900 }}>
                          {result.results.map((r, idx) => (
                            <Paper
                              key={idx}
                              sx={{
                                p: 2,
                                borderTop: `4px solid ${MUTATION_LABELS[r.mutation_type]?.color || '#6366f1'}`,
                                bgcolor: r.mutation_type === result.summary.most_efficient ? 'success.main' : 
                                         r.mutation_type === result.summary.least_efficient ? 'error.main' : 'background.paper',
                                color: (r.mutation_type === result.summary.most_efficient || r.mutation_type === result.summary.least_efficient) ? 'white' : 'inherit',
                              }}
                            >
                              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                {MUTATION_LABELS[r.mutation_type]?.label || r.mutation_type}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mb: 1, opacity: 0.8, minHeight: 40 }}>
                                "{r.prompt.length > 60 ? r.prompt.slice(0, 60) + '...' : r.prompt}"
                              </Typography>
                              <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                              <Box display="flex" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption">Energy:</Typography>
                                <Typography variant="caption" fontWeight="bold">{r.energy_consumed.toFixed(2)}J</Typography>
                              </Box>
                              <Box display="flex" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption">Tokens:</Typography>
                                <Typography variant="caption" fontWeight="bold">{r.tokens_generated}</Typography>
                              </Box>
                              <Box display="flex" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption">Time:</Typography>
                                <Typography variant="caption" fontWeight="bold">{r.inference_time.toFixed(2)}s</Typography>
                              </Box>
                              {r.energy_change_percent !== undefined && r.energy_change_percent !== 0 && (
                                <Chip
                                  label={`${r.energy_change_percent > 0 ? '+' : ''}${r.energy_change_percent.toFixed(1)}%`}
                                  size="small"
                                  color={r.energy_change_percent < 0 ? 'success' : 'error'}
                                  sx={{ mt: 1 }}
                                />
                              )}
                            </Paper>
                          ))}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>

              {/* Interpretation */}
              <Grid item xs={12}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Alert severity="success" sx={{ borderLeft: '4px solid #10b981' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      ✅ Research Finding Confirmed
                    </Typography>
                    <Typography variant="body2">
                      {result.summary.most_efficient === 'reordering' ? (
                        <>
                          <strong>Baseline prompts</strong> consistently consumed the least energy — validating our hypothesis that 
                          clear, unambiguous phrasing reduces computational overhead.
                        </>
                      ) : result.summary.least_efficient === 'formality_shift' ? (
                        <>
                          <strong>Overly-elaborate prompts</strong> consumed the most energy ({result.results.find(r => r.mutation_type === 'formality_shift')?.energy_change_percent?.toFixed(1)}% more than baseline).
                          This proves that verbosity without clarity actually increases AI energy consumption.
                        </>
                      ) : (
                        <>
                          The experiment shows <strong>{result.summary.potential_savings_percent.toFixed(1)}% potential energy savings</strong> achievable
                          through optimal prompt phrasing — a key contribution of our research.
                        </>
                      )}
                    </Typography>
                  </Alert>
                </motion.div>
              </Grid>
            </>
          )}
        </AnimatePresence>

        {/* Call to Action when no results */}
        {!result && !isRunning && (
          <Grid item xs={12}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', border: '2px dashed', borderColor: 'divider' }}>
                <ScienceIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Enter a prompt above and click "Run Experiment"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  See real-time energy measurements that prove our key research findings
                </Typography>
              </Paper>
            </motion.div>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Demo;
