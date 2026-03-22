import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Skeleton,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Science as ScienceIcon,
  Bolt as BoltIcon,
  TrendingUp as TrendingIcon,
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon,
  Speed as SpeedIcon,
  RocketLaunch as RocketIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { dashboardApi, Experiment } from '../services/api';

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

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  gradient?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color, trend, gradient }) => (
  <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
    <Card 
      sx={{ 
        position: 'relative',
        overflow: 'hidden',
        background: gradient || `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, transparent 100%)`,
        borderLeft: `4px solid ${color}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '150px',
          height: '150px',
          background: `radial-gradient(circle, ${alpha(color, 0.15)} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
        },
        '&:hover': {
          boxShadow: `0 20px 40px ${alpha(color, 0.25)}, 0 0 60px ${alpha(color, 0.1)}`,
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography 
              variant="overline" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 800, 
                background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {trend !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    borderRadius: 2,
                    bgcolor: trend >= 0 ? alpha('#10b981', 0.15) : alpha('#ef4444', 0.15),
                  }}
                >
                  <TrendingIcon 
                    sx={{ 
                      fontSize: 16, 
                      color: trend >= 0 ? '#10b981' : '#ef4444',
                      transform: trend < 0 ? 'rotate(180deg)' : 'none'
                    }} 
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ color: trend >= 0 ? '#10b981' : '#ef4444', ml: 0.5, fontWeight: 600 }}
                  >
                    {Math.abs(trend)}%
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
              color: 'white',
              boxShadow: `0 8px 20px ${alpha(color, 0.4)}`,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

// Experiment Card Component
const ExperimentCard: React.FC<{ experiment: Experiment; index?: number }> = ({ experiment, index = 0 }) => {
  const navigate = useNavigate();
  
  const statusConfig: Record<string, { color: string; gradient: string }> = {
    pending: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    running: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    completed: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    failed: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    cancelled: { color: '#94a3b8', gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' },
  };

  const config = statusConfig[experiment.status] || statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
    >
      <Card 
        sx={{ 
          cursor: 'pointer',
          background: `linear-gradient(135deg, ${alpha(config.color, 0.08)} 0%, transparent 100%)`,
          border: `1px solid ${alpha(config.color, 0.2)}`,
          '&:hover': {
            borderColor: alpha(config.color, 0.4),
            boxShadow: `0 20px 40px ${alpha(config.color, 0.2)}`,
          },
        }}
        onClick={() => navigate(`/experiments/${experiment.id}`)}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" noWrap sx={{ maxWidth: 200, fontWeight: 700 }}>
              {experiment.name}
            </Typography>
            <Chip
              size="small"
              label={experiment.status}
              sx={{
                background: config.gradient,
                color: 'white',
                fontWeight: 700,
                textTransform: 'capitalize',
                boxShadow: `0 4px 12px ${alpha(config.color, 0.4)}`,
              }}
            />
          </Box>

          {experiment.status === 'running' && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" sx={{ color: config.color, fontWeight: 600 }}>
                  {Math.round((experiment.progress || 0) * 100)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(experiment.progress || 0) * 100}
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: alpha(config.color, 0.15),
                  '& .MuiLinearProgress-bar': {
                    background: config.gradient,
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Measurements
              </Typography>
              <Typography variant="body1" fontWeight={700} sx={{ color: config.color }}>
                {(experiment.total_measurements || 0).toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                PEC Score
              </Typography>
              <Typography variant="body1" fontWeight={700} sx={{ color: config.color }}>
                {experiment.pec_score ? experiment.pec_score.toFixed(3) : '—'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Main Dashboard Component
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats().then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: recentExperiments, isLoading: experimentsLoading } = useQuery({
    queryKey: ['recent-experiments'],
    queryFn: () => dashboardApi.getRecentExperiments(6).then(res => res.data),
    refetchInterval: 10000,
  });

  const { data: energyTimeline } = useQuery({
    queryKey: ['energy-timeline'],
    queryFn: () => dashboardApi.getEnergyTimeline(60).then(res => res.data),
  });

  const { data: mutationComparison } = useQuery({
    queryKey: ['mutation-comparison'],
    queryFn: () => dashboardApi.getMutationComparison().then(res => res.data),
  });

  // Format mutation names for display
  const formatMutationType = (type: string) => {
    return type
      .replace('MutationType.', '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const formattedMutationData = mutationComparison?.map((m: any) => ({
    ...m,
    name: formatMutationType(m.mutation_type),
  })) || [];

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
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 50%, rgba(236, 72, 153, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 182, 212, 0.05) 50%, rgba(236, 72, 153, 0.05) 100%)',
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
              ? 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.2) 0%, transparent 60%)'
              : 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.1) 0%, transparent 60%)',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <RocketIcon sx={{ fontSize: 40, color: '#8b5cf6' }} />
              </motion.div>
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #ec4899 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Research Dashboard
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
              Monitor your computational entropy experiments in real-time with advanced analytics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh data">
              <IconButton 
                onClick={() => refetchStats()}
                sx={{ 
                  bgcolor: alpha('#8b5cf6', 0.1),
                  '&:hover': { bgcolor: alpha('#8b5cf6', 0.2) },
                }}
              >
                <RefreshIcon sx={{ color: '#8b5cf6' }} />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<SparkleIcon />}
              onClick={() => navigate('/experiments/new')}
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
                px: 3,
                py: 1.5,
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 32px rgba(139, 92, 246, 0.5)',
                },
              }}
            >
              New Experiment
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div variants={itemVariants}>
            {statsLoading ? (
              <Skeleton variant="rounded" height={160} sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)' }} />
            ) : (
              <StatCard
                title="Total Experiments"
                value={stats?.total_experiments || 0}
                icon={<ScienceIcon sx={{ fontSize: 28 }} />}
                color="#8b5cf6"
                gradient="linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.05) 100%)"
                trend={12}
              />
            )}
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div variants={itemVariants}>
            {statsLoading ? (
              <Skeleton variant="rounded" height={160} sx={{ bgcolor: 'rgba(6, 182, 212, 0.1)' }} />
            ) : (
              <StatCard
                title="Total Measurements"
                value={(stats?.total_measurements || 0).toLocaleString()}
                icon={<AnalyticsIcon sx={{ fontSize: 28 }} />}
                color="#06b6d4"
                gradient="linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 145, 178, 0.05) 100%)"
                trend={8}
              />
            )}
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div variants={itemVariants}>
            {statsLoading ? (
              <Skeleton variant="rounded" height={160} sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)' }} />
            ) : (
              <StatCard
                title="Energy Used"
                value={`${(stats?.total_energy_kwh || 0).toFixed(4)} kWh`}
                icon={<BoltIcon sx={{ fontSize: 28 }} />}
                color="#f59e0b"
                gradient="linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.05) 100%)"
                trend={-5}
              />
            )}
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div variants={itemVariants}>
            {statsLoading ? (
              <Skeleton variant="rounded" height={160} sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)' }} />
            ) : (
              <StatCard
                title="Average PEC"
                value={(stats?.avg_pec_score || 0).toFixed(3)}
                icon={<SpeedIcon sx={{ fontSize: 28 }} />}
                color="#10b981"
                gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)"
                trend={4}
              />
            )}
          </motion.div>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {/* Energy Timeline */}
        <Grid item xs={12} md={8}>
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    }}
                  >
                    <TrendingIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Energy Consumption Over Time
                  </Typography>
                </Box>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={energyTimeline || []}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.08)'} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
                        axisLine={{ stroke: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)' }}
                      />
                      <YAxis 
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
                        tickFormatter={(v) => `${v.toFixed(4)}`}
                        axisLine={{ stroke: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)' }}
                      />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: isDark ? 'rgba(3, 7, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'}`,
                          borderRadius: 12,
                          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                          color: isDark ? '#f1f5f9' : '#0f172a',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="energy_kwh"
                        stroke="#8b5cf6"
                        fillOpacity={1}
                        fill="url(#colorEnergy)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Mutation Comparison */}
        <Grid item xs={12} md={4}>
          <motion.div variants={itemVariants}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, transparent 100%)',
                border: '1px solid rgba(6, 182, 212, 0.15)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    }}
                  >
                    <BoltIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Energy by Mutation
                  </Typography>
                </Box>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedMutationData} layout="vertical">
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.1)" />
                      <XAxis 
                        type="number" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(6, 182, 212, 0.2)' }}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        width={90}
                        axisLine={{ stroke: 'rgba(6, 182, 212, 0.2)' }}
                      />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: isDark ? 'rgba(3, 7, 18, 0.95)' : 'rgba(255, 255, 255, 0.97)',
                          border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}`,
                          borderRadius: 12,
                          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(15, 23, 42, 0.12)',
                          color: isDark ? '#f1f5f9' : '#0f172a',
                        }}
                        labelStyle={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}
                        itemStyle={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                      />
                      <Bar 
                        dataKey="mean_energy_per_token_mj" 
                        fill="url(#barGradient)"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Recent Experiments */}
      <Box sx={{ mb: 4 }}>
        <motion.div variants={itemVariants}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                }}
              >
                <ScienceIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Recent Experiments
              </Typography>
            </Box>
            <Button 
              variant="outlined"
              onClick={() => navigate('/experiments')}
              sx={{ 
                borderColor: 'rgba(236, 72, 153, 0.3)',
                color: '#ec4899',
                '&:hover': {
                  borderColor: '#ec4899',
                  bgcolor: 'rgba(236, 72, 153, 0.1)',
                },
              }}
            >
              View All →
            </Button>
          </Box>
        </motion.div>
        <Grid container spacing={3}>
          {experimentsLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Skeleton 
                  variant="rounded" 
                  height={180} 
                  sx={{ bgcolor: 'rgba(236, 72, 153, 0.1)' }}
                />
              </Grid>
            ))
          ) : (
            recentExperiments?.map((exp: Experiment, index: number) => (
              <Grid item xs={12} sm={6} md={4} key={exp.id}>
                <ExperimentCard experiment={exp} index={index} />
              </Grid>
            ))
          )}
        </Grid>
      </Box>
    </motion.div>
  );
};

export default Dashboard;

