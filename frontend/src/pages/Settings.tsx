import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { settingsApi, Settings, Provider } from '../services/api';

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

const SettingsPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  // Form state
  const [provider, setProvider] = useState('simulation');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-3.5-turbo');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-haiku-20240307');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  
  // Connection test results
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    loadSettings();
    loadProviders();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      const data = response.data;
      setSettings(data);
      setProvider(data.provider);
      setOpenaiModel(data.openai_model);
      setAnthropicModel(data.anthropic_model);
      setTemperature(data.temperature);
      setMaxTokens(data.max_tokens);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await settingsApi.getProviders();
      setProviders(response.data.providers);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        provider,
        openai_model: openaiModel,
        anthropic_model: anthropicModel,
        temperature,
        max_tokens: maxTokens,
      };
      
      // Only include API keys if they were changed (not empty)
      if (openaiKey) {
        updateData.openai_api_key = openaiKey;
      }
      if (anthropicKey) {
        updateData.anthropic_api_key = anthropicKey;
      }
      
      const response = await settingsApi.update(updateData);
      setSettings(response.data);
      toast.success('Settings saved successfully!');
      
      // Clear API key fields after successful save
      setOpenaiKey('');
      setAnthropicKey('');
      
      // Reload providers to update configured status
      loadProviders();
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTesting(providerId);
    try {
      const response = await settingsApi.testConnection(providerId);
      setTestResults(prev => ({
        ...prev,
        [providerId]: response.data
      }));
      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Connection test failed';
      setTestResults(prev => ({
        ...prev,
        [providerId]: { success: false, message }
      }));
      toast.error(message);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress sx={{ color: '#8b5cf6' }} />
      </Box>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Header */}
      <Box 
        sx={{ 
          mb: 5,
          p: 4,
          borderRadius: 4,
          background: isDark 
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(236, 72, 153, 0.05) 100%)',
          border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)'}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '40%',
            height: '100%',
            background: isDark 
              ? 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.15) 0%, transparent 60%)'
              : 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.08) 0%, transparent 60%)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <SettingsIcon sx={{ fontSize: 40, color: '#8b5cf6' }} />
          </motion.div>
          <Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 800,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Settings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure LLM providers and experiment defaults
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* LLM Provider Selection */}
        <Grid item xs={12}>
          <motion.div variants={itemVariants}>
            <Card
              sx={{
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
                  : 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%)',
                border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)'}`,
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#8b5cf6', mb: 1 }}>
                  LLM Provider
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Select the AI model provider for running experiments
                </Typography>

                <Grid container spacing={2}>
                  {providers.map((p) => {
                    const isSelected = provider === p.id;
                    return (
                      <Grid item xs={12} md={4} key={p.id}>
                        <motion.div whileHover={{ scale: 1.02 }}>
                          <Card 
                            sx={{ 
                              cursor: 'pointer',
                              border: isSelected ? '2px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.2)',
                              background: isSelected 
                                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)'
                                : 'transparent',
                              '&:hover': { 
                                borderColor: '#8b5cf6',
                                boxShadow: `0 8px 24px ${alpha('#8b5cf6', 0.2)}`,
                              },
                            }}
                            onClick={() => setProvider(p.id)}
                          >
                            <CardContent>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle1" fontWeight={700}>
                                  {p.name}
                                </Typography>
                                {p.configured && (
                                  <Chip 
                                    label="Configured" 
                                    size="small"
                                    sx={{
                                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                      color: 'white',
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {p.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {p.models.slice(0, 3).map((model) => (
                                  <Chip key={model} label={model} size="small" variant="outlined" />
                                ))}
                                {p.models.length > 3 && (
                                  <Chip label={`+${p.models.length - 3} more`} size="small" />
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* OpenAI Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">OpenAI Configuration</Typography>
                {settings?.has_openai_key && (
                  <Chip label="API Key Set" color="success" size="small" icon={<CheckIcon />} />
                )}
              </Box>

              <TextField
                fullWidth
                label="API Key"
                type="password"
                placeholder={settings?.has_openai_key ? '••••••••••••••••' : 'sk-...'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                helperText="Enter your OpenAI API key"
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={openaiModel}
                  label="Model"
                  onChange={(e) => setOpenaiModel(e.target.value)}
                >
                  <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast, Cheap)</MenuItem>
                  <MenuItem value="gpt-4">GPT-4 (Powerful)</MenuItem>
                  <MenuItem value="gpt-4-turbo">GPT-4 Turbo (Faster)</MenuItem>
                  <MenuItem value="gpt-4o">GPT-4o (Latest)</MenuItem>
                  <MenuItem value="gpt-4o-mini">GPT-4o Mini (Efficient)</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                onClick={() => handleTestConnection('openai')}
                disabled={testing === 'openai' || !settings?.has_openai_key}
                startIcon={testing === 'openai' ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                Test Connection
              </Button>
              
              {testResults.openai && (
                <Alert 
                  severity={testResults.openai.success ? 'success' : 'error'} 
                  sx={{ mt: 2 }}
                  icon={testResults.openai.success ? <CheckIcon /> : <ErrorIcon />}
                >
                  {testResults.openai.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Anthropic Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Anthropic Configuration</Typography>
                {settings?.has_anthropic_key && (
                  <Chip label="API Key Set" color="success" size="small" icon={<CheckIcon />} />
                )}
              </Box>

              <TextField
                fullWidth
                label="API Key"
                type="password"
                placeholder={settings?.has_anthropic_key ? '••••••••••••••••' : 'sk-ant-...'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                helperText="Enter your Anthropic API key"
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={anthropicModel}
                  label="Model"
                  onChange={(e) => setAnthropicModel(e.target.value)}
                >
                  <MenuItem value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</MenuItem>
                  <MenuItem value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</MenuItem>
                  <MenuItem value="claude-3-opus-20240229">Claude 3 Opus (Powerful)</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                onClick={() => handleTestConnection('anthropic')}
                disabled={testing === 'anthropic' || !settings?.has_anthropic_key}
                startIcon={testing === 'anthropic' ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                Test Connection
              </Button>
              
              {testResults.anthropic && (
                <Alert 
                  severity={testResults.anthropic.success ? 'success' : 'error'} 
                  sx={{ mt: 2 }}
                  icon={testResults.anthropic.success ? <CheckIcon /> : <ErrorIcon />}
                >
                  {testResults.anthropic.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Generation Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generation Defaults
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Default settings for LLM inference
              </Typography>

              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Temperature: {temperature}
                  </Typography>
                  <Slider
                    value={temperature}
                    onChange={(_, value) => setTemperature(value as number)}
                    min={0}
                    max={2}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0 (Deterministic)' },
                      { value: 1, label: '1 (Balanced)' },
                      { value: 2, label: '2 (Creative)' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Lower values make output more focused, higher values more random
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Max Tokens: {maxTokens}
                  </Typography>
                  <Slider
                    value={maxTokens}
                    onChange={(_, value) => setMaxTokens(value as number)}
                    min={50}
                    max={2000}
                    step={50}
                    marks={[
                      { value: 50, label: '50' },
                      { value: 500, label: '500' },
                      { value: 1000, label: '1000' },
                      { value: 2000, label: '2000' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Maximum number of tokens to generate in responses
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Info */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              About Simulation Mode
            </Typography>
            <Typography variant="body2">
              Simulation mode allows you to test the platform without using API credits. 
              It generates realistic timing and token counts for valid research data structure, 
              but responses are simulated. Use OpenAI or Anthropic for real LLM responses.
            </Typography>
          </Alert>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={loadSettings}
              disabled={saving}
              sx={{
                borderColor: 'rgba(139, 92, 246, 0.3)',
                color: '#8b5cf6',
                '&:hover': {
                  borderColor: '#8b5cf6',
                  bgcolor: alpha('#8b5cf6', 0.1),
                },
              }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                },
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </motion.div>
  );
};

export default SettingsPage;
