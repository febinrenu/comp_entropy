import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import InsightsIcon from '@mui/icons-material/Insights';
import RefreshIcon from '@mui/icons-material/Refresh';
import { promptsApi, MutationPreviewResponse } from '../services/api';

interface MutationResult {
  original: string;
  mutated: string;
  mutation_type: string;
  changes: string[];
  metrics: {
    word_count_change: number;
    semantic_instability_index: number | null;
    flesch_reading_ease: number | null;
  };
}

// These match the backend's real MutationType enum values exactly
// (app/models/prompt.py) -- the previous list here (SYNONYM_REPLACEMENT,
// PARAPHRASE, PASSIVE_ACTIVE_CONVERSION, etc.) didn't correspond to any
// backend mutation type at all, so wiring this page to the real API
// required fixing the options themselves, not just the API call.
const mutationTypes = [
  { value: 'noise_typo', label: 'Typo Noise', icon: '🔤', description: 'Keyboard-adjacent character typos' },
  { value: 'noise_verbose', label: 'Verbose Filler', icon: '📝', description: 'Insert filler phrases' },
  { value: 'ambiguity_semantic', label: 'Semantic Ambiguity', icon: '❓', description: 'Vague pronouns and quantifiers' },
  { value: 'ambiguity_contradiction', label: 'Contradiction', icon: '⚡', description: 'Insert contradictory statements' },
  { value: 'negation', label: 'Negation', icon: '❌', description: 'Confusing double negatives' },
  { value: 'reordering', label: 'Reordering', icon: '🔀', description: 'Shuffle sentence/word order' },
  { value: 'formality_shift', label: 'Formality Shift', icon: '👔', description: 'Shift formal/informal register' },
  { value: 'code_switching', label: 'Code-Switching', icon: '🌐', description: 'Insert foreign-language phrases' },
];

const examplePrompts = [
  "Explain the concept of machine learning in simple terms.",
  "What are the key differences between Python and JavaScript?",
  "Describe the process of photosynthesis.",
  "How does blockchain technology work?",
  "What is the significance of the Turing test?",
];

const Playground: React.FC = () => {
  const [originalText, setOriginalText] = useState('');
  const [mutationType, setMutationType] = useState('noise_typo');
  const [intensity, setIntensity] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MutationResult[]>([]);
  const [history, setHistory] = useState<MutationResult[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalMutations: 0,
    avgSiiChange: 0,
    avgWordCountChange: 0,
  });

  // Calls the real backend mutation engine (POST /api/prompts/mutate) --
  // previously this ran a client-side fake simulateMutation() and never
  // touched the API at all.
  const performMutation = useCallback(async () => {
    if (!originalText.trim()) {
      setError('Please enter some text to mutate');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await promptsApi.mutate(originalText, mutationType, intensity);
      const data: MutationPreviewResponse = response.data;

      const changes: string[] = [];
      const params = data.mutation_params;
      if (params && Array.isArray((params as any).changes)) {
        for (const c of (params as any).changes as any[]) {
          if (typeof c === 'string') changes.push(c);
          else if (c && typeof c === 'object') {
            changes.push(Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(', '));
          }
        }
      }
      if (changes.length === 0) changes.push('No changes recorded for this intensity/type combination');

      const result: MutationResult = {
        original: data.original_text,
        mutated: data.text,
        mutation_type: data.mutation_type,
        changes,
        metrics: {
          word_count_change: (data.word_count ?? 0) - originalText.split(' ').length,
          semantic_instability_index: data.semantic_instability_index,
          flesch_reading_ease: data.flesch_reading_ease,
        },
      };

      setResults([result, ...results.slice(0, 4)]);
      setHistory([result, ...history.slice(0, 19)]);
      setStats({
        totalMutations: stats.totalMutations + 1,
        avgSiiChange:
          (stats.avgSiiChange * stats.totalMutations + (result.metrics.semantic_instability_index ?? 0)) /
          (stats.totalMutations + 1),
        avgWordCountChange:
          (stats.avgWordCountChange * stats.totalMutations + result.metrics.word_count_change) /
          (stats.totalMutations + 1),
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || 'Failed to perform mutation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [originalText, mutationType, intensity, results, history, stats]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadExample = () => {
    setOriginalText(examplePrompts[Math.floor(Math.random() * examplePrompts.length)]);
  };

  return (
    <Box>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Mutation Explorer
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Apply the real mutation engine to a prompt and see its effect on the Semantic
            Instability Index and readability -- calls the same backend used by real experiments.
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={600}>
                    📝 Input Prompt
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={loadExample}
                  >
                    Load Example
                  </Button>
                </Box>

                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={originalText}
                  onChange={(e) => setOriginalText(e.target.value)}
                  placeholder="Enter your prompt here..."
                  variant="outlined"
                  sx={{ mb: 3 }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Mutation Type</InputLabel>
                      <Select
                        value={mutationType}
                        onChange={(e) => setMutationType(e.target.value)}
                        label="Mutation Type"
                      >
                        {mutationTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <span>{type.icon}</span>
                              <Box>
                                <Typography variant="body2">{type.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {type.description}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Mutation Intensity: {(intensity * 100).toFixed(0)}%
                    </Typography>
                    <Slider
                      value={intensity}
                      onChange={(_, value) => setIntensity(value as number)}
                      min={0.1}
                      max={1}
                      step={0.1}
                      marks={[
                        { value: 0.1, label: 'Low' },
                        { value: 0.5, label: 'Medium' },
                        { value: 1, label: 'High' },
                      ]}
                      sx={{ mt: 2 }}
                    />
                  </Grid>
                </Grid>

                <Box mt={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
                    onClick={performMutation}
                    disabled={isLoading || !originalText.trim()}
                    sx={{
                      py: 1.5,
                      background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a6fd6 30%, #6a4190 90%)',
                      },
                    }}
                  >
                    {isLoading ? 'Mutating...' : 'Apply Mutation'}
                  </Button>
                </Box>

                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Quick Stats */}
                <Box mt={3}>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'primary.dark' }}>
                        <Typography variant="h5" fontWeight={700}>
                          {stats.totalMutations}
                        </Typography>
                        <Typography variant="caption">Total Mutations</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'secondary.dark' }}>
                        <Typography variant="h5" fontWeight={700}>
                          {stats.avgWordCountChange > 0 ? '+' : ''}{stats.avgWordCountChange.toFixed(1)}
                        </Typography>
                        <Typography variant="caption">Avg Word Δ</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'success.dark' }}>
                        <Typography variant="h5" fontWeight={700}>
                          {stats.avgSiiChange.toFixed(2)}
                        </Typography>
                        <Typography variant="caption">Avg SII</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab icon={<CompareArrowsIcon />} label="Results" />
                    <Tab icon={<HistoryIcon />} label="History" />
                  </Tabs>
                </Box>

                <AnimatePresence mode="wait">
                  {activeTab === 0 ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {results.length > 0 ? (
                        <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                          {results.map((result, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                  <Chip
                                    label={result.mutation_type.replace(/_/g, ' ')}
                                    size="small"
                                    color="primary"
                                  />
                                  <Tooltip title="Copy mutated text">
                                    <IconButton size="small" onClick={() => copyToClipboard(result.mutated)}>
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  <strong>Original:</strong> {result.original}
                                </Typography>

                                <Typography variant="body2" sx={{ mb: 2, p: 1, bgcolor: 'primary.dark', borderRadius: 1 }}>
                                  <strong>Mutated:</strong> {result.mutated}
                                </Typography>

                                <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
                                  {result.changes.map((change, i) => (
                                    <Chip key={i} label={change} size="small" variant="outlined" />
                                  ))}
                                </Box>

                                <Grid container spacing={1}>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" color="text.secondary">
                                      Words: {result.metrics.word_count_change > 0 ? '+' : ''}
                                      {result.metrics.word_count_change}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" color="text.secondary">
                                      SII: {result.metrics.semantic_instability_index?.toFixed(3) ?? '—'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" color="text.secondary">
                                      Flesch: {result.metrics.flesch_reading_ease?.toFixed(1) ?? '—'}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Paper>
                            </motion.div>
                          ))}
                        </Box>
                      ) : (
                        <Box textAlign="center" py={8}>
                          <InsightsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                          <Typography color="text.secondary">
                            No mutations yet. Enter a prompt and click "Apply Mutation" to see results.
                          </Typography>
                        </Box>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {history.length > 0 ? (
                        <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                          {history.map((item, index) => (
                            <Paper key={index} sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Chip
                                  label={item.mutation_type.replace(/_/g, ' ')}
                                  size="small"
                                  variant="outlined"
                                />
                                <Typography variant="caption" color="text.secondary">
                                  #{history.length - index}
                                </Typography>
                              </Box>
                              <Typography variant="body2" noWrap sx={{ mt: 1 }}>
                                {item.mutated}
                              </Typography>
                            </Paper>
                          ))}
                        </Box>
                      ) : (
                        <Box textAlign="center" py={8}>
                          <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                          <Typography color="text.secondary">
                            No history yet.
                          </Typography>
                        </Box>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Playground;
