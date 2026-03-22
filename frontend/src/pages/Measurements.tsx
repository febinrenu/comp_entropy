import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  Chip,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  TableChart as TableIcon,
  ShowChart as ChartIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { measurementsApi, exportApi, Measurement } from '../services/api';
import toast from 'react-hot-toast';

const mutationColors: Record<string, string> = {
  baseline: '#6366f1',
  noise_typo: '#ef4444',
  noise_verbose: '#f59e0b',
  ambiguity_semantic: '#10b981',
  ambiguity_contradiction: '#8b5cf6',
  negation: '#06b6d4',
  reordering: '#ec4899',
  formality_shift: '#14b8a6',
  code_switching: '#f97316',
};

const Measurements: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [experimentFilter, setExperimentFilter] = useState<number | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['measurements', page, experimentFilter],
    queryFn: () => measurementsApi.list(page, pageSize, experimentFilter || undefined).then(res => res.data),
  });

  const measurements = data?.measurements || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  // Compute statistics using available fields
  const stats = measurements.reduce((acc: any, m: Measurement) => {
    const energy = m.total_energy_joules || m.energy_joules || 0;
    const time = m.total_time_seconds || m.inference_time || 0;
    acc.totalEnergy += energy;
    acc.totalTime += time;
    acc.totalTokens += (m.input_tokens || 0) + (m.output_tokens || 0) + (m.total_tokens || 0);
    const mutationType = m.prompt?.mutation_type || 'unknown';
    acc.byType[mutationType] = (acc.byType[mutationType] || 0) + 1;
    return acc;
  }, { totalEnergy: 0, totalTime: 0, totalTokens: 0, byType: {} });

  const avgEnergy = measurements.length > 0 ? stats.totalEnergy / measurements.length : 0;
  const avgTime = measurements.length > 0 ? stats.totalTime / measurements.length : 0;

  // Chart data
  const scatterData = measurements.map((m: Measurement) => ({
    stability: m.prompt?.stability_score || 0,
    energy: (m.total_energy_joules || m.energy_joules || 0) * 1000,
    mutationType: m.prompt?.mutation_type || 'baseline',
    latency: (m.total_time_seconds || m.inference_time || 0) * 1000,
  }));

  const barChartData = Object.entries(stats.byType).map(([type, count]) => ({
    type: type.replace('_', ' '),
    count: count as number,
    color: mutationColors[type] || '#666',
  }));

  const energyTimelineData = measurements.map((m: Measurement, i: number) => ({
    index: i,
    energy: (m.total_energy_joules || m.energy_joules || 0) * 1000,
    latency: (m.total_time_seconds || m.inference_time || 0) * 1000,
  }));

  const handleExport = async () => {
    try {
      const response = await exportApi.exportMeasurements(experimentFilter || undefined, 'csv');
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'measurements.csv';
      a.click();
      toast.success('Exported measurements to CSV');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Measurements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and analyze energy consumption measurements
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="table">
              <TableIcon />
            </ToggleButton>
            <ToggleButton value="chart">
              <ChartIcon />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Measurements
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {data?.total?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Avg Energy per Inference
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {(avgEnergy * 1000).toFixed(3)}
                <Typography component="span" variant="body2" color="text.secondary"> mJ</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Avg Latency
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {(avgTime * 1000).toFixed(1)}
                <Typography component="span" variant="body2" color="text.secondary"> ms</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Energy Consumed
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {(stats.totalEnergy * 1000).toFixed(2)}
                <Typography component="span" variant="body2" color="text.secondary"> mJ</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search measurements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />
          
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={(e) => setFilterAnchorEl(e.currentTarget)}
            sx={{ ml: 'auto' }}
          >
            {experimentFilter ? `Experiment: ${experimentFilter}` : 'Filter by Experiment'}
          </Button>
          
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={() => setFilterAnchorEl(null)}
          >
            <MenuItem onClick={() => { setExperimentFilter(null); setFilterAnchorEl(null); }}>
              All Experiments
            </MenuItem>
          </Menu>
        </CardContent>
      </Card>

      {viewMode === 'chart' ? (
        /* Charts View */
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Stability vs Energy (PEC Visualization)
                </Typography>
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="stability" 
                        stroke={isDark ? '#666' : '#94a3b8'} 
                        name="Stability"
                        domain={[0, 1]}
                        label={{ value: 'Stability Score', position: 'bottom', fill: isDark ? '#999' : '#64748b' }}
                      />
                      <YAxis 
                        dataKey="energy" 
                        stroke={isDark ? '#666' : '#94a3b8'} 
                        name="Energy (mJ)"
                        label={{ value: 'Energy (mJ)', angle: -90, position: 'insideLeft', fill: isDark ? '#999' : '#64748b' }}
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
                        opacity={0.6}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Measurements by Type
                </Typography>
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer>
                    <BarChart data={barChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                      <XAxis type="number" stroke={isDark ? '#666' : '#94a3b8'} />
                      <YAxis dataKey="type" type="category" stroke={isDark ? '#666' : '#94a3b8'} width={100} />
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
                      <Bar dataKey="count" name="Count">
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Energy & Latency Over Time
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={energyTimelineData}>
                      <defs>
                        <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="energy"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#energyGrad)"
                        name="Energy (mJ)"
                      />
                      <Area
                        type="monotone"
                        dataKey="latency"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#latencyGrad)"
                        name="Latency (ms)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        /* Table View */
        <>
          <TableContainer component={Paper} sx={{ bgcolor: 'background.paper' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Prompt</TableCell>
                  <TableCell>Mutation Type</TableCell>
                  <TableCell align="right">Stability</TableCell>
                  <TableCell align="right">Energy (mJ)</TableCell>
                  <TableCell align="right">Latency (ms)</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Energy/Token (mJ)</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array(10).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      {Array(9).fill(0).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : measurements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">
                        No measurements found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  measurements.map((m: Measurement) => {
                    const energy = m.total_energy_joules || m.energy_joules || 0;
                    const time = m.total_time_seconds || m.inference_time || 0;
                    const tokens = (m.input_tokens || 0) + (m.output_tokens || 0) + (m.total_tokens || 0);
                    return (
                      <TableRow key={m.id} hover>
                        <TableCell>{m.id}</TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Tooltip title={m.prompt?.text || ''}>
                            <Typography variant="body2" noWrap>
                              {m.prompt?.text?.slice(0, 40) || `Prompt #${m.prompt_id}`}...
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={(m.prompt?.mutation_type || 'baseline').replace('_', ' ')}
                            sx={{
                              bgcolor: `${mutationColors[m.prompt?.mutation_type || 'baseline']}20`,
                              color: mutationColors[m.prompt?.mutation_type || 'baseline'],
                              fontSize: 11,
                            }}
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
                        <TableCell align="right">
                          {m.energy_per_token_mj?.toFixed(3) || '—'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(m.created_at), 'MMM d, HH:mm')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default Measurements;
