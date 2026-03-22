import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  LinearProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Science as ScienceIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { experimentsApi, Experiment } from '../services/api';

const statusConfig: Record<string, { color: string; gradient: string }> = {
  pending: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  running: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  completed: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
  failed: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  cancelled: { color: '#94a3b8', gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const Experiments: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['experiments', page, statusFilter],
    queryFn: () => experimentsApi.list(page, pageSize, statusFilter || undefined).then(res => res.data),
    refetchInterval: 5000,
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => experimentsApi.run(id),
    onSuccess: () => {
      toast.success('Experiment started!');
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start experiment');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => experimentsApi.cancel(id),
    onSuccess: () => {
      toast.success('Experiment cancelled');
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel experiment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => experimentsApi.delete(id),
    onSuccess: () => {
      toast.success('Experiment deleted');
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete experiment');
    },
  });

  const experiments = data?.experiments || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const filteredExperiments = experiments.filter((exp: Experiment) =>
    exp.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, experiment: Experiment) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedExperiment(experiment);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedExperiment(null);
  };

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
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 50%, rgba(236, 72, 153, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 182, 212, 0.05) 50%, rgba(236, 72, 153, 0.03) 100%)',
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <ScienceIcon sx={{ fontSize: 40, color: '#8b5cf6' }} />
              </motion.div>
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Experiments
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
              Manage and monitor your research experiments with real-time tracking
            </Typography>
          </Box>
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

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card 
          sx={{ 
            mb: 4,
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, transparent 100%)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
          }}
        >
          <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search experiments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#06b6d4' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                minWidth: 300,
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#06b6d4',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#06b6d4',
                    boxShadow: `0 0 0 3px ${alpha('#06b6d4', 0.15)}`,
                  },
                },
              }}
            />
            
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
              sx={{ 
                ml: 'auto',
                borderColor: statusFilter ? statusConfig[statusFilter]?.color || 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)',
                color: statusFilter ? statusConfig[statusFilter]?.color || '#8b5cf6' : '#8b5cf6',
                '&:hover': {
                  borderColor: '#8b5cf6',
                  bgcolor: alpha('#8b5cf6', 0.1),
                },
              }}
            >
              {statusFilter ? `Status: ${statusFilter}` : 'Filter'}
            </Button>
            
            <Menu
              anchorEl={filterAnchorEl}
              open={Boolean(filterAnchorEl)}
              onClose={() => setFilterAnchorEl(null)}
              PaperProps={{
                sx: {
                  bgcolor: 'rgba(3, 7, 18, 0.95)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  backdropFilter: 'blur(20px)',
                },
              }}
            >
              <MenuItem onClick={() => { setStatusFilter(null); setFilterAnchorEl(null); }}>
                All
              </MenuItem>
              {Object.entries(statusConfig).map(([status, config]) => (
                <MenuItem 
                  key={status}
                  onClick={() => { setStatusFilter(status); setFilterAnchorEl(null); }}
                  sx={{
                    '&:hover': { bgcolor: alpha(config.color, 0.1) },
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: config.color,
                      mr: 1.5,
                    }}
                  />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Menu>
          </CardContent>
        </Card>
      </motion.div>

      {/* Experiments Table */}
      <motion.div variants={itemVariants}>
        <TableContainer 
          component={Paper} 
          sx={{ 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%)',
            border: '1px solid rgba(139, 92, 246, 0.1)',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#8b5cf6' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#8b5cf6' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#8b5cf6' }}>Progress</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#8b5cf6' }}>Measurements</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#8b5cf6' }}>PEC Score</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#8b5cf6' }}>Created</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: '#8b5cf6' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)' }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredExperiments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">
                    No experiments found
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/experiments/new')}
                    sx={{ 
                      mt: 2,
                      borderColor: 'rgba(139, 92, 246, 0.3)',
                      color: '#8b5cf6',
                      '&:hover': {
                        borderColor: '#8b5cf6',
                        bgcolor: alpha('#8b5cf6', 0.1),
                      },
                    }}
                  >
                    Create Your First Experiment
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredExperiments.map((exp: Experiment, index: number) => {
                const config = statusConfig[exp.status] || statusConfig.pending;
                return (
                  <motion.tr
                    key={exp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {exp.name}
                      </Typography>
                      {exp.description && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                          {exp.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={exp.status}
                        sx={{
                          background: config.gradient,
                          color: 'white',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          boxShadow: `0 4px 12px ${alpha(config.color, 0.4)}`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {exp.status === 'running' ? (
                        <Box sx={{ width: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={exp.progress * 100}
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
                          <Typography variant="caption" sx={{ color: config.color, fontWeight: 600 }}>
                            {Math.round(exp.progress * 100)}%
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {exp.status === 'completed' ? '100%' : '—'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {exp.total_measurements.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: exp.pec_score ? 700 : 400,
                          color: exp.pec_score ? config.color : 'text.secondary',
                        }}
                      >
                        {exp.pec_score ? exp.pec_score.toFixed(3) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(exp.created_at), 'MMM d, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, exp)}
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(config.color, 0.1),
                          },
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            sx={{
              '& .MuiPaginationItem-root': {
                color: '#8b5cf6',
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                },
                '&:hover': {
                  bgcolor: alpha('#8b5cf6', 0.1),
                },
              },
            }}
          />
        </Box>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(3, 7, 18, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            backdropFilter: 'blur(20px)',
          },
        }}
      >
        <MenuItem 
          onClick={() => {
            if (selectedExperiment) navigate(`/experiments/${selectedExperiment.id}`);
            handleMenuClose();
          }}
          sx={{ '&:hover': { bgcolor: alpha('#8b5cf6', 0.1) } }}
        >
          <ViewIcon sx={{ mr: 1, color: '#8b5cf6' }} /> View Details
        </MenuItem>
        
        {selectedExperiment?.status === 'pending' && (
          <MenuItem 
            onClick={() => {
              if (selectedExperiment) runMutation.mutate(selectedExperiment.id);
              handleMenuClose();
            }}
            sx={{ '&:hover': { bgcolor: alpha('#10b981', 0.1) } }}
          >
            <PlayIcon sx={{ mr: 1, color: '#10b981' }} /> 
            <Typography sx={{ color: '#10b981' }}>Run</Typography>
          </MenuItem>
        )}
        
        {selectedExperiment?.status === 'running' && (
          <MenuItem 
            onClick={() => {
              if (selectedExperiment) cancelMutation.mutate(selectedExperiment.id);
              handleMenuClose();
            }}
            sx={{ '&:hover': { bgcolor: alpha('#f59e0b', 0.1) } }}
          >
            <StopIcon sx={{ mr: 1, color: '#f59e0b' }} />
            <Typography sx={{ color: '#f59e0b' }}>Cancel</Typography>
          </MenuItem>
        )}
        
        {selectedExperiment?.status !== 'running' && (
          <MenuItem 
            onClick={() => {
              setDeleteDialogOpen(true);
              setMenuAnchorEl(null);
            }}
            sx={{ '&:hover': { bgcolor: alpha('#ef4444', 0.1) } }}
          >
            <DeleteIcon sx={{ mr: 1, color: '#ef4444' }} />
            <Typography sx={{ color: '#ef4444' }}>Delete</Typography>
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(3, 7, 18, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backdropFilter: 'blur(20px)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#ef4444', fontWeight: 700 }}>
          Delete Experiment
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "<Box component="span" sx={{ color: '#8b5cf6', fontWeight: 600 }}>{selectedExperiment?.name}</Box>"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedExperiment) deleteMutation.mutate(selectedExperiment.id);
            }}
            sx={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default Experiments;

