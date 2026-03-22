import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
  Tooltip,
  Alert,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Science as ScienceIcon,
  Bolt as EnergyIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { experimentsApi, measurementsApi, Measurement } from '../services/api';

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

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  running: '#10b981',
  completed: '#6366f1',
  failed: '#ef4444',
  cancelled: '#94a3b8',
};

const ExperimentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [tabValue, setTabValue] = useState(0);

  const { data: experiment, isLoading, refetch } = useQuery({
    queryKey: ['experiment', id],
    queryFn: () => experimentsApi.get(Number(id)).then(res => res.data),
    refetchInterval: (query) => query.state.data?.status === 'running' ? 2000 : false,
  });

  const { data: measurements } = useQuery({
    queryKey: ['measurements', id],
    queryFn: () => measurementsApi.listForExperiment(Number(id)).then(res => res.data),
    enabled: !!experiment,
  });

  const runMutation = useMutation({
    mutationFn: () => experimentsApi.run(Number(id)),
    onSuccess: () => {
      toast.success('Experiment started!');
      queryClient.invalidateQueries({ queryKey: ['experiment', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start experiment');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => experimentsApi.cancel(Number(id)),
    onSuccess: () => {
      toast.success('Experiment cancelled');
      queryClient.invalidateQueries({ queryKey: ['experiment', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel experiment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => experimentsApi.delete(Number(id)),
    onSuccess: () => {
      toast.success('Experiment deleted');
      navigate('/experiments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete experiment');
    },
  });

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (!experiment) {
    return (
      <Alert severity="error">
        Experiment not found
        <Button onClick={() => navigate('/experiments')} sx={{ ml: 2 }}>
          Back to Experiments
        </Button>
      </Alert>
    );
  }

  const measurementData = measurements || [];
  
  const energyChartData = measurementData.map((m: Measurement, i: number) => ({
    index: i,
    energy: (m.total_energy_joules || m.energy_joules || 0) * 1000,
    stability: m.prompt?.stability_score || 0,
    mutationType: m.prompt?.mutation_type || 'baseline',
  }));

  const scatterData = measurementData.map((m: Measurement) => ({
    stability: m.prompt?.stability_score || 0,
    energy: (m.total_energy_joules || m.energy_joules || 0) * 1000,
    mutationType: m.prompt?.mutation_type || 'baseline',
  }));

  const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
  }> = ({ title, value, subtitle, icon, color }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: `${color}15`,
            color: color,
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/experiments')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {experiment.name}
            </Typography>
            <Chip
              size="small"
              label={experiment.status}
              sx={{
                bgcolor: `${statusColors[experiment.status]}20`,
                color: statusColors[experiment.status],
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            />
          </Box>
          {experiment.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {experiment.description}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {experiment.status === 'pending' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayIcon />}
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
            >
              Run
            </Button>
          )}
          
          {experiment.status === 'running' && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<StopIcon />}
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
          )}
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => window.open(`http://localhost:8000/api/export/experiment/${id}/csv`, '_blank')}
          >
            Export
          </Button>
          
          {experiment.status !== 'running' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          )}
        </Box>
      </Box>

      {/* Progress Bar for Running Experiments */}
      {experiment.status === 'running' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Progress</Typography>
              <Typography variant="body2" fontWeight={600}>
                {Math.round(experiment.progress * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={experiment.progress * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Measurements"
            value={experiment.total_measurements.toLocaleString()}
            icon={<ScienceIcon />}
            color="#6366f1"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Energy"
            value={`${((experiment.total_energy_kwh || 0) * 1000000).toFixed(2)} mJ`}
            icon={<EnergyIcon />}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="PEC Score"
            value={experiment.pec_score?.toFixed(4) || '—'}
            subtitle="Prompt Entropy Coefficient"
            icon={<MemoryIcon />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Prompts"
            value={experiment.num_prompts}
            icon={<SpeedIcon />}
            color="#ec4899"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Overview" />
            <Tab label="Energy Analysis" />
            <Tab label="Measurements" />
            <Tab label="Configuration" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Energy Consumption Over Time
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer>
                    <AreaChart data={energyChartData}>
                      <defs>
                        <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                      <XAxis dataKey="index" stroke={isDark ? '#666' : '#94a3b8'} />
                      <YAxis stroke={isDark ? '#666' : '#94a3b8'} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
                          border: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
                          borderRadius: 8,
                          color: isDark ? '#f1f5f9' : '#0f172a',
                        }}
                        labelStyle={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}
                        itemStyle={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="energy"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#energyGradient)"
                        name="Energy (mJ)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Experiment Info
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Created</Typography>
                    <Typography>{format(new Date(experiment.created_at), 'PPpp')}</Typography>
                  </Box>
                  {experiment.started_at && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Started</Typography>
                      <Typography>{format(new Date(experiment.started_at), 'PPpp')}</Typography>
                    </Box>
                  )}
                  {experiment.completed_at && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Completed</Typography>
                      <Typography>{format(new Date(experiment.completed_at), 'PPpp')}</Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary">Model</Typography>
                    <Typography>{experiment.model_name || 'Default'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Mutations</Typography>
                    <Typography>{experiment.mutation_types?.join(', ') || 'All'}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        {/* Energy Analysis Tab */}
        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Stability vs Energy (PEC Correlation)
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="stability" 
                        stroke={isDark ? '#666' : '#94a3b8'} 
                        name="Stability Score"
                        domain={[0, 1]}
                      />
                      <YAxis 
                        dataKey="energy" 
                        stroke={isDark ? '#666' : '#94a3b8'} 
                        name="Energy (mJ)"
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
                          border: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
                          borderRadius: 8,
                          color: isDark ? '#f1f5f9' : '#0f172a',
                        }}
                        labelStyle={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}
                        itemStyle={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                        formatter={(value: number, name: string) => [
                          name === 'energy' ? `${value.toFixed(3)} mJ` : value.toFixed(3),
                          name === 'energy' ? 'Energy' : 'Stability'
                        ]}
                      />
                      <Scatter 
                        data={scatterData} 
                        fill="#6366f1"
                        opacity={0.7}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Energy by Measurement
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer>
                    <LineChart data={energyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                      <XAxis dataKey="index" stroke={isDark ? '#666' : '#94a3b8'} />
                      <YAxis stroke={isDark ? '#666' : '#94a3b8'} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
                          border: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
                          borderRadius: 8,
                          color: isDark ? '#f1f5f9' : '#0f172a',
                        }}
                        labelStyle={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}
                        itemStyle={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="energy"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name="Energy (mJ)"
                      />
                      <Line
                        type="monotone"
                        dataKey="stability"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        name="Stability"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        {/* Measurements Tab */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Prompt</TableCell>
                  <TableCell>Mutation</TableCell>
                  <TableCell align="right">Stability</TableCell>
                  <TableCell align="right">Energy (mJ)</TableCell>
                  <TableCell align="right">Latency (ms)</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {measurementData.slice(0, 50).map((m: Measurement, i: number) => {
                  const energy = m.total_energy_joules || m.energy_joules || 0;
                  const time = m.total_time_seconds || m.inference_time || 0;
                  const tokens = (m.input_tokens || 0) + (m.output_tokens || 0) + (m.total_tokens || 0);
                  return (
                    <TableRow key={m.id} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Tooltip title={m.prompt?.text || ''}>
                          <Typography variant="body2" noWrap>
                            {m.prompt?.text?.slice(0, 50) || `Prompt #${m.prompt_id}`}...
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={m.prompt?.mutation_type || 'baseline'}
                          sx={{ fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {(m.prompt?.stability_score || 0).toFixed(3)}
                      </TableCell>
                      <TableCell align="right">
                        {(energy * 1000).toFixed(3)}
                      </TableCell>
                      <TableCell align="right">
                        {(time * 1000).toFixed(1)}
                      </TableCell>
                      <TableCell align="right">
                        {tokens || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {measurementData.length > 50 && (
            <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block' }}>
              Showing first 50 of {measurementData.length} measurements
            </Typography>
          )}
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={tabValue} index={3}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Experiment Configuration
            </Typography>
            <Paper
              sx={{
                p: 2,
                bgcolor: isDark ? 'grey.900' : 'grey.100',
                border: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
                fontFamily: 'monospace',
              }}
            >
              <pre style={{ margin: 0, overflow: 'auto' }}>
                {JSON.stringify({
                  name: experiment.name,
                  description: experiment.description,
                  status: experiment.status,
                  model: experiment.model_name,
                  num_prompts: experiment.num_prompts,
                  runs_per_prompt: experiment.runs_per_prompt,
                  mutation_types: experiment.mutation_types,
                }, null, 2)}
              </pre>
            </Paper>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default ExperimentDetail;
