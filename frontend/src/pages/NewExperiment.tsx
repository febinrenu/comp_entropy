import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Slider,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Science as ScienceIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { experimentsApi, settingsApi, Settings } from '../services/api';

const MUTATION_TYPES = [
  { id: 'baseline', label: 'Baseline', description: 'Original prompts without mutation', color: '#6366f1' },
  { id: 'noise_typo', label: 'Typo Noise', description: 'Inject realistic character-level typos', color: '#ef4444' },
  { id: 'noise_verbose', label: 'Verbose Noise', description: 'Add verbosity and filler phrasing', color: '#f59e0b' },
  { id: 'ambiguity_semantic', label: 'Semantic Ambiguity', description: 'Introduce vague or ambiguous wording', color: '#10b981' },
  { id: 'ambiguity_contradiction', label: 'Contradiction', description: 'Inject contradictory phrasing', color: '#8b5cf6' },
  { id: 'negation', label: 'Negation', description: 'Add negation and double-negation patterns', color: '#06b6d4' },
  { id: 'reordering', label: 'Reordering', description: 'Reorder sentence structure and flow', color: '#ec4899' },
  { id: 'formality_shift', label: 'Formality Shift', description: 'Shift between formal/informal register', color: '#14b8a6' },
  { id: 'code_switching', label: 'Code Switching', description: 'Insert multilingual phrases', color: '#f97316' },
];

const NewExperiment: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMutations, setSelectedMutations] = useState<string[]>(['baseline', 'noise_verbose']);
  const [numPrompts, setNumPrompts] = useState(5);
  const [runsPerPrompt, setRunsPerPrompt] = useState(3);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      setSettings(response.data);
      setTemperature(response.data.temperature);
      setMaxTokens(response.data.max_tokens);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const toggleMutation = (id: string) => {
    if (selectedMutations.includes(id)) {
      if (selectedMutations.length > 1) {
        setSelectedMutations(selectedMutations.filter(m => m !== id));
      }
    } else {
      setSelectedMutations([...selectedMutations, id]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter an experiment name');
      return;
    }

    setLoading(true);
    try {
      // Get current provider and model
      let provider = settings?.provider || 'simulation';
      let model = '';
      
      if (provider === 'openai') {
        model = settings?.openai_model || 'gpt-3.5-turbo';
      } else if (provider === 'anthropic') {
        model = settings?.anthropic_model || 'claude-3-haiku-20240307';
      } else {
        model = 'simulation-model';
      }

      const experimentData = {
        name: name.trim(),
        description: description.trim() || undefined,
        mutation_types: selectedMutations,
        num_prompts: numPrompts,
        runs_per_prompt: runsPerPrompt,
        warmup_runs: 1,
        config: {
          provider,
          model,
          max_tokens: maxTokens,
          temperature,
        },
      };

      const response = await experimentsApi.create(experimentData);
      toast.success('Experiment created successfully!');
      navigate(`/experiments/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create experiment:', error);
      toast.error(error.response?.data?.detail || 'Failed to create experiment');
    } finally {
      setLoading(false);
    }
  };

  const totalIterations = numPrompts * selectedMutations.length * runsPerPrompt;
  const estimatedTime = Math.ceil(totalIterations * 1.5); // ~1.5 seconds per iteration in simulation

  const getProviderName = () => {
    if (!settings) return 'Loading...';
    switch (settings.provider) {
      case 'openai':
        return `OpenAI (${settings.openai_model})`;
      case 'anthropic':
        return `Anthropic (${settings.anthropic_model})`;
      default:
        return 'Simulation Mode';
    }
  };

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          New Experiment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure and create a new computational entropy experiment
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Info */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>

              <TextField
                fullWidth
                label="Experiment Name"
                placeholder="e.g., Medical Query Energy Study"
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 3 }}
                required
              />

              <TextField
                fullWidth
                label="Description"
                placeholder="Describe the purpose of this experiment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={3}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Provider Info */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                LLM Provider
              </Typography>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'action.hover', 
                borderRadius: 2,
                textAlign: 'center'
              }}>
                <ScienceIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  {getProviderName()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Configure in Settings page
                </Typography>
              </Box>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => navigate('/settings')}
                sx={{ mt: 2 }}
              >
                Change Provider
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Mutation Types */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mutation Types
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select which prompt mutations to test (at least one required)
              </Typography>

              <Grid container spacing={2}>
                {MUTATION_TYPES.map((mutation) => (
                  <Grid item xs={12} sm={6} md={4} key={mutation.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        border: selectedMutations.includes(mutation.id) ? '2px solid' : '1px solid',
                        borderColor: selectedMutations.includes(mutation.id) ? mutation.color : 'divider',
                        bgcolor: selectedMutations.includes(mutation.id) ? `${mutation.color}10` : 'background.paper',
                        '&:hover': { borderColor: mutation.color },
                      }}
                      onClick={() => toggleMutation(mutation.id)}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: mutation.color,
                            }}
                          />
                          <Typography variant="subtitle2" fontWeight={600}>
                            {mutation.label}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {mutation.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Experiment Parameters */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Experiment Parameters
              </Typography>

              <Box sx={{ mb: 4 }}>
                <Typography gutterBottom>
                  Number of Prompts: {numPrompts}
                </Typography>
                <Slider
                  value={numPrompts}
                  onChange={(_, value) => setNumPrompts(value as number)}
                  min={1}
                  max={20}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box>
                <Typography gutterBottom>
                  Runs Per Prompt: {runsPerPrompt}
                </Typography>
                <Slider
                  value={runsPerPrompt}
                  onChange={(_, value) => setRunsPerPrompt(value as number)}
                  min={1}
                  max={10}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 3, label: '3' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Generation Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generation Settings
              </Typography>

              <Box sx={{ mb: 4 }}>
                <Typography gutterBottom>
                  Temperature: {temperature}
                </Typography>
                <Slider
                  value={temperature}
                  onChange={(_, value) => setTemperature(value as number)}
                  min={0}
                  max={1.5}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.7, label: '0.7' },
                    { value: 1.5, label: '1.5' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box>
                <Typography gutterBottom>
                  Max Tokens: {maxTokens}
                </Typography>
                <Slider
                  value={maxTokens}
                  onChange={(_, value) => setMaxTokens(value as number)}
                  min={50}
                  max={1000}
                  step={50}
                  marks={[
                    { value: 50, label: '50' },
                    { value: 256, label: '256' },
                    { value: 500, label: '500' },
                    { value: 1000, label: '1000' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Summary */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'primary.dark' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                Experiment Summary
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Mutation Types
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                    {selectedMutations.length}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Total Iterations
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                    {totalIterations}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Est. Measurements
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                    {totalIterations}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Est. Time
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                    ~{estimatedTime}s
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Info Alert */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>How it works:</strong> The experiment will run {numPrompts} prompts 
              (from a built-in library) through {selectedMutations.length} mutation types, 
              with {runsPerPrompt} runs each for statistical validity. 
              Energy consumption, inference time, and token usage will be measured for each run.
            </Typography>
          </Alert>
        </Grid>

        {/* Actions */}
        <Grid item xs={12}>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/experiments')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
            >
              {loading ? 'Creating...' : 'Create Experiment'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NewExperiment;
