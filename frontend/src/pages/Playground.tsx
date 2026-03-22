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

interface MutationResult {
  original: string;
  mutated: string;
  mutation_type: string;
  changes: string[];
  metrics: {
    word_count_change: number;
    char_count_change: number;
    complexity_change: number;
  };
}

const mutationTypes = [
  { value: 'SYNONYM_REPLACEMENT', label: 'Synonym Replacement', icon: '🔄', description: 'Replace words with synonyms' },
  { value: 'PARAPHRASE', label: 'Paraphrase', icon: '📝', description: 'Rephrase while keeping meaning' },
  { value: 'WORD_ORDER_CHANGE', label: 'Word Order Change', icon: '🔀', description: 'Shuffle word positions' },
  { value: 'PASSIVE_ACTIVE_CONVERSION', label: 'Voice Conversion', icon: '🔊', description: 'Change active/passive voice' },
  { value: 'FORMALITY_SHIFT', label: 'Formality Shift', icon: '👔', description: 'Adjust formality level' },
  { value: 'SIMPLIFICATION', label: 'Simplification', icon: '✨', description: 'Simplify complex language' },
  { value: 'ELABORATION', label: 'Elaboration', icon: '📚', description: 'Add more detail' },
  { value: 'NEGATION_INSERTION', label: 'Negation', icon: '❌', description: 'Insert negations' },
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
  const [mutationType, setMutationType] = useState('SYNONYM_REPLACEMENT');
  const [intensity, setIntensity] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MutationResult[]>([]);
  const [history, setHistory] = useState<MutationResult[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalMutations: 0,
    avgComplexityChange: 0,
    avgWordCountChange: 0,
  });

  // Simulated mutation function (can be connected to real API)
  const performMutation = useCallback(async () => {
    if (!originalText.trim()) {
      setError('Please enter some text to mutate');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call with realistic mutation
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 500));

      const mutated = simulateMutation(originalText, mutationType, intensity);
      
      const result: MutationResult = {
        original: originalText,
        mutated: mutated.text,
        mutation_type: mutationType,
        changes: mutated.changes,
        metrics: {
          word_count_change: mutated.text.split(' ').length - originalText.split(' ').length,
          char_count_change: mutated.text.length - originalText.length,
          complexity_change: Math.round((Math.random() - 0.5) * 20),
        },
      };

      setResults([result, ...results.slice(0, 4)]);
      setHistory([result, ...history.slice(0, 19)]);
      setStats({
        totalMutations: stats.totalMutations + 1,
        avgComplexityChange: (stats.avgComplexityChange * stats.totalMutations + result.metrics.complexity_change) / (stats.totalMutations + 1),
        avgWordCountChange: (stats.avgWordCountChange * stats.totalMutations + result.metrics.word_count_change) / (stats.totalMutations + 1),
      });
    } catch (err) {
      setError('Failed to perform mutation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [originalText, mutationType, intensity, results, history, stats]);

  const simulateMutation = (text: string, type: string, intensity: number) => {
    const words = text.split(' ');
    const changes: string[] = [];
    let mutatedWords = [...words];

    const synonymMap: Record<string, string[]> = {
      'explain': ['describe', 'elucidate', 'clarify', 'illustrate'],
      'concept': ['idea', 'notion', 'principle', 'theory'],
      'simple': ['basic', 'straightforward', 'elementary', 'uncomplicated'],
      'key': ['main', 'primary', 'essential', 'crucial'],
      'differences': ['distinctions', 'variations', 'contrasts', 'disparities'],
      'describe': ['explain', 'outline', 'depict', 'portray'],
      'process': ['procedure', 'method', 'mechanism', 'operation'],
      'work': ['function', 'operate', 'perform', 'run'],
      'significance': ['importance', 'relevance', 'meaning', 'value'],
    };

    const numChanges = Math.ceil(words.length * intensity * 0.3);

    switch (type) {
      case 'SYNONYM_REPLACEMENT':
        for (let i = 0; i < numChanges; i++) {
          const idx = Math.floor(Math.random() * mutatedWords.length);
          const word = mutatedWords[idx].toLowerCase().replace(/[.,!?]/g, '');
          if (synonymMap[word]) {
            const synonym = synonymMap[word][Math.floor(Math.random() * synonymMap[word].length)];
            const punct = mutatedWords[idx].match(/[.,!?]$/)?.[0] || '';
            changes.push(`"${word}" → "${synonym}"`);
            mutatedWords[idx] = synonym + punct;
          }
        }
        break;

      case 'PARAPHRASE':
        if (text.includes('explain')) {
          mutatedWords = ['Could', 'you', 'provide', 'an', 'explanation', 'of', ...mutatedWords.slice(2)];
          changes.push('Restructured as a question');
        }
        break;

      case 'FORMALITY_SHIFT':
        mutatedWords = ['I', 'would', 'like', 'to', 'understand', ...mutatedWords.slice(1)];
        changes.push('Added formal prefix');
        break;

      case 'SIMPLIFICATION':
        mutatedWords = mutatedWords.filter((w) => w.length < 10 || Math.random() > 0.5);
        changes.push('Removed complex words');
        break;

      case 'ELABORATION':
        mutatedWords.splice(2, 0, 'specifically', 'and', 'comprehensively');
        changes.push('Added elaborating words');
        break;

      default:
        // Shuffle some words for other types
        for (let i = 0; i < numChanges; i++) {
          const idx1 = Math.floor(Math.random() * mutatedWords.length);
          const idx2 = Math.floor(Math.random() * mutatedWords.length);
          [mutatedWords[idx1], mutatedWords[idx2]] = [mutatedWords[idx2], mutatedWords[idx1]];
          changes.push(`Swapped positions ${idx1} ↔ ${idx2}`);
        }
    }

    if (changes.length === 0) {
      changes.push('Minor adjustments applied');
    }

    return { text: mutatedWords.join(' '), changes };
  };

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
            🧪 Mutation Playground
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Experiment with different prompt mutations and see how they affect text characteristics.
            Explore the relationship between linguistic changes and computational entropy.
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
                          {stats.avgComplexityChange > 0 ? '+' : ''}{stats.avgComplexityChange.toFixed(1)}%
                        </Typography>
                        <Typography variant="caption">Avg Complexity</Typography>
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
                                      Chars: {result.metrics.char_count_change > 0 ? '+' : ''}
                                      {result.metrics.char_count_change}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" color="text.secondary">
                                      Complexity: {result.metrics.complexity_change > 0 ? '+' : ''}
                                      {result.metrics.complexity_change}%
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
