import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Paper,
  Button,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import SpeedIcon from '@mui/icons-material/Speed';
import MemoryIcon from '@mui/icons-material/Memory';
import BoltIcon from '@mui/icons-material/Bolt';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import { RealTimeChart } from './Charts';

interface LiveMetrics {
  timestamp: number;
  power: number;
  cpu: number;
  gpu: number;
  memory: number;
  temperature: number;
  tokensPerSec: number;
}

interface ExperimentStatus {
  id: number;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  currentPrompt: number;
  totalPrompts: number;
  currentRun: number;
  runsPerPrompt: number;
  currentMutation: string;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  totalEnergyConsumed: number;
  metrics: LiveMetrics[];
}

const LiveMonitor: React.FC<{ experimentId?: number }> = ({ experimentId }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<ExperimentStatus | null>(null);
  const [powerHistory, setPowerHistory] = useState<{ time: string; power: number }[]>([]);
  const [cpuHistory, setCpuHistory] = useState<{ time: string; cpu: number }[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<{ time: string; memory: number }[]>([]);
  const [tokensHistory, setTokensHistory] = useState<{ time: string; tokens: number }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const simulateMetrics = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    // Simulate realistic metrics
    const basePower = 150 + Math.random() * 50;
    const baseCpu = 45 + Math.random() * 30;
    const baseMemory = 60 + Math.random() * 20;
    const baseTokens = 25 + Math.random() * 15;

    setPowerHistory((prev) => [...prev.slice(-29), { time: timeStr, power: basePower }]);
    setCpuHistory((prev) => [...prev.slice(-29), { time: timeStr, cpu: baseCpu }]);
    setMemoryHistory((prev) => [...prev.slice(-29), { time: timeStr, memory: baseMemory }]);
    setTokensHistory((prev) => [...prev.slice(-29), { time: timeStr, tokens: baseTokens }]);

    if (status) {
      setStatus((prev) => {
        if (!prev) return prev;
        const newProgress = Math.min(prev.progress + 0.5, 100);
        return {
          ...prev,
          progress: newProgress,
          elapsedTime: prev.elapsedTime + 1,
          estimatedTimeRemaining: Math.max(0, prev.estimatedTimeRemaining - 1),
          totalEnergyConsumed: prev.totalEnergyConsumed + basePower / 3600,
          currentRun: Math.floor((newProgress / 100) * prev.runsPerPrompt * prev.totalPrompts) % prev.runsPerPrompt + 1,
          currentPrompt: Math.floor((newProgress / 100) * prev.totalPrompts) + 1,
        };
      });
    }
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    setStatus({
      id: experimentId || 1,
      name: 'Computational Entropy Experiment',
      status: 'running',
      progress: 0,
      currentPrompt: 1,
      totalPrompts: 10,
      currentRun: 1,
      runsPerPrompt: 5,
      currentMutation: 'SYNONYM_REPLACEMENT',
      elapsedTime: 0,
      estimatedTimeRemaining: 120,
      totalEnergyConsumed: 0,
      metrics: [],
    });

    intervalRef.current = setInterval(simulateMetrics, 1000);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
              📡 Live Experiment Monitor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time energy and performance metrics during experiment execution
            </Typography>
          </Box>
          <Box>
            {!isMonitoring ? (
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayArrowIcon />}
                onClick={startMonitoring}
                sx={{ mr: 1 }}
              >
                Start Demo
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<PauseIcon />}
                  sx={{ mr: 1 }}
                >
                  Pause
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={stopMonitoring}
                >
                  Stop
                </Button>
              </>
            )}
          </Box>
        </Box>
      </motion.div>

      {!isMonitoring ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
          <MemoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Active Experiment
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Start a demo to see real-time monitoring in action, or run an experiment from the Experiments page.
          </Typography>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={startMonitoring}>
            Start Live Demo
          </Button>
        </Paper>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Status Bar */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Chip
                          icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', mr: -0.5 }} />}
                          label={status?.status.toUpperCase()}
                          color="success"
                          size="small"
                        />
                      </motion.div>
                      <Typography variant="h6" fontWeight={600}>
                        {status?.name}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Box display="flex" gap={3} flexWrap="wrap">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Prompt
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {status?.currentPrompt} / {status?.totalPrompts}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Run
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {status?.currentRun} / {status?.runsPerPrompt}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Mutation
                        </Typography>
                        <Chip label={status?.currentMutation} size="small" />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Elapsed
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatTime(status?.elapsedTime || 0)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          ETA
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatTime(status?.estimatedTimeRemaining || 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                <Box mt={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Progress</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {status?.progress.toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={status?.progress || 0}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.800',
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Real-time Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { icon: <BoltIcon />, label: 'Power', value: powerHistory[powerHistory.length - 1]?.power.toFixed(1) || '0', unit: 'W', color: '#ffd93d' },
                { icon: <MemoryIcon />, label: 'CPU', value: cpuHistory[cpuHistory.length - 1]?.cpu.toFixed(1) || '0', unit: '%', color: '#6bcb77' },
                { icon: <SpeedIcon />, label: 'Tokens/sec', value: tokensHistory[tokensHistory.length - 1]?.tokens.toFixed(1) || '0', unit: '', color: '#4d96ff' },
                { icon: <ThermostatIcon />, label: 'Energy Used', value: status?.totalEnergyConsumed.toFixed(2) || '0', unit: 'Wh', color: '#ff6b6b' },
              ].map((stat, index) => (
                <Grid item xs={6} md={3} key={stat.label}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        background: `linear-gradient(135deg, ${stat.color}20 0%, transparent 100%)`,
                        borderLeft: `3px solid ${stat.color}`,
                      }}
                    >
                      <Box sx={{ color: stat.color, mb: 1 }}>{stat.icon}</Box>
                      <Typography variant="h4" fontWeight={700} sx={{ color: stat.color }}>
                        {stat.value}
                        <Typography component="span" variant="body2">
                          {stat.unit}
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stat.label}
                      </Typography>
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>

            {/* Live Charts */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <RealTimeChart
                  data={powerHistory}
                  title="⚡ Power Consumption (W)"
                  dataKey="power"
                  color="#ffd93d"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RealTimeChart
                  data={cpuHistory}
                  title="🖥️ CPU Utilization (%)"
                  dataKey="cpu"
                  color="#6bcb77"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RealTimeChart
                  data={tokensHistory}
                  title="📝 Token Generation (tok/s)"
                  dataKey="tokens"
                  color="#4d96ff"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RealTimeChart
                  data={memoryHistory}
                  title="💾 Memory Usage (%)"
                  dataKey="memory"
                  color="#ff6b6b"
                />
              </Grid>
            </Grid>
          </motion.div>
        </AnimatePresence>
      )}
    </Box>
  );
};

export default LiveMonitor;
