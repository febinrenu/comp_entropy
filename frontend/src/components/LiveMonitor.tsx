import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import MemoryIcon from '@mui/icons-material/Memory';
import SpeedIcon from '@mui/icons-material/Speed';
import BoltIcon from '@mui/icons-material/Bolt';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import { RealTimeChart } from './Charts';
import { dashboardApi, experimentsApi, getWebSocketUrl } from '../services/api';

interface ExperimentProgress {
  experimentId: number;
  name: string;
  status: string;
  progress: number;
  currentStep: string | null;
  totalMeasurements: number;
  lastSii: number | null;
  lastEptMj: number | null;
  lastTokensPerSecond: number | null;
  lastMeasurementSource: string | null;
}

/**
 * Real-time monitor: experiment progress arrives over the backend's real
 * WebSocket (/api/dashboard/ws, fed by broadcast_experiment_update in
 * experiment_runner.py); power/CPU/GPU numbers are polled from the real
 * /api/dashboard/realtime-power endpoint (energy_monitor.get_realtime_stats()).
 * Previously this entire component was `setInterval` + `Math.random()`
 * and never touched the network at all.
 */
const LiveMonitor: React.FC<{ experimentId?: number }> = ({ experimentId }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [progress, setProgress] = useState<ExperimentProgress | null>(null);
  const [powerHistory, setPowerHistory] = useState<{ time: string; power: number }[]>([]);
  const [cpuHistory, setCpuHistory] = useState<{ time: string; cpu: number }[]>([]);
  const [gpuHistory, setGpuHistory] = useState<{ time: string; gpu: number }[]>([]);
  const [tokensHistory, setTokensHistory] = useState<{ time: string; tokens: number }[]>([]);
  const [gpuPowerSource, setGpuPowerSource] = useState<string>('idle_estimate');
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollPower = useCallback(async () => {
    try {
      const res = await dashboardApi.getRealtimePower();
      const now = new Date().toLocaleTimeString();
      setPowerHistory((prev) => [...prev.slice(-29), { time: now, power: res.data.power_watts }]);
      setCpuHistory((prev) => [...prev.slice(-29), { time: now, cpu: res.data.cpu_utilization }]);
      setGpuHistory((prev) => [...prev.slice(-29), { time: now, gpu: res.data.gpu_utilization }]);
      setGpuPowerSource(res.data.gpu_power_source);
    } catch {
      // Backend unreachable -- leave the last known values on screen
      // rather than fabricating a new random point.
    }
  }, []);

  const startMonitoring = useCallback(async () => {
    setIsMonitoring(true);

    let name = 'Live Monitor';
    if (experimentId) {
      try {
        const exp = await experimentsApi.get(experimentId);
        name = exp.data.name;
      } catch {
        // fall through with generic name
      }
    }
    setProgress({
      experimentId: experimentId || 0,
      name,
      status: 'connecting',
      progress: 0,
      currentStep: null,
      totalMeasurements: 0,
      lastSii: null,
      lastEptMj: null,
      lastTokensPerSecond: null,
      lastMeasurementSource: null,
    });

    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      if (experimentId) {
        ws.send(JSON.stringify({ type: 'subscribe', experiment_id: experimentId }));
      }
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type !== 'experiment_update') return;
      if (experimentId && message.experiment_id !== experimentId) return;

      setProgress((prev) => ({
        experimentId: message.experiment_id,
        name: prev?.name || name,
        status: message.status ?? prev?.status ?? 'running',
        progress: (message.progress ?? 0) * 100,
        currentStep: message.current_step ?? null,
        totalMeasurements: message.total_measurements ?? prev?.totalMeasurements ?? 0,
        lastSii: message.last_sii ?? null,
        lastEptMj: message.last_ept_mj ?? null,
        lastTokensPerSecond: message.last_tokens_per_second ?? null,
        lastMeasurementSource: message.last_measurement_source ?? null,
      }));

      if (typeof message.last_tokens_per_second === 'number') {
        setTokensHistory((prev) => [
          ...prev.slice(-29),
          { time: new Date().toLocaleTimeString(), tokens: message.last_tokens_per_second },
        ]);
      }
    };

    pollPower();
    pollRef.current = setInterval(pollPower, 2000);
  }, [experimentId, pollPower]);

  const stopMonitoring = () => {
    setIsMonitoring(false);
    wsRef.current?.close();
    wsRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
              Real WebSocket experiment progress + real power draw ({gpuPowerSource === 'nvml_real' ? 'NVML GPU' : 'CPU estimate only, no GPU detected'})
            </Typography>
          </Box>
          <Box>
            {!isMonitoring ? (
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayArrowIcon />}
                onClick={startMonitoring}
              >
                Connect
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={stopMonitoring}
              >
                Disconnect
              </Button>
            )}
          </Box>
        </Box>
      </motion.div>

      {!isMonitoring ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
          <MemoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Not Connected
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Connect to see real-time power draw and, if an experiment is running, its live progress
            over the WebSocket.
          </Typography>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={startMonitoring}>
            Connect
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
                      <Chip
                        icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: progress?.status === 'running' ? 'success.main' : 'grey.500', mr: -0.5 }} />}
                        label={(progress?.status || 'connecting').toUpperCase()}
                        color={progress?.status === 'running' ? 'success' : 'default'}
                        size="small"
                      />
                      <Typography variant="h6" fontWeight={600}>
                        {progress?.name}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Box display="flex" gap={3} flexWrap="wrap">
                      <Box>
                        <Typography variant="caption" color="text.secondary">Measurements</Typography>
                        <Typography variant="body2" fontWeight={600}>{progress?.totalMeasurements ?? 0}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Last SII</Typography>
                        <Typography variant="body2" fontWeight={600}>{progress?.lastSii?.toFixed(3) ?? '—'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Last EPT (mJ/tok)</Typography>
                        <Typography variant="body2" fontWeight={600}>{progress?.lastEptMj?.toFixed(2) ?? '—'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Energy source</Typography>
                        <Chip label={progress?.lastMeasurementSource ?? 'n/a'} size="small" />
                      </Box>
                      {progress?.currentStep && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Step</Typography>
                          <Typography variant="body2" fontWeight={600}>{progress.currentStep}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                </Grid>

                <Box mt={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Progress</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {progress?.progress.toFixed(1) ?? 0}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress?.progress || 0}
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
                { icon: <ThermostatIcon />, label: 'GPU', value: gpuHistory[gpuHistory.length - 1]?.gpu.toFixed(1) || '0', unit: '%', color: '#ff6b6b' },
                { icon: <SpeedIcon />, label: 'Tokens/sec', value: tokensHistory[tokensHistory.length - 1]?.tokens.toFixed(1) || '—', unit: '', color: '#4d96ff' },
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
                  data={gpuHistory}
                  title="🎮 GPU Utilization (%)"
                  dataKey="gpu"
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
