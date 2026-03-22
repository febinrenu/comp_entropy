import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Tooltip,
  LinearProgress,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { promptsApi, Prompt } from '../services/api';

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

const Prompts: React.FC = () => {
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');

  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['prompts', page, typeFilter],
    queryFn: () => promptsApi.list(page, pageSize, typeFilter || undefined).then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => promptsApi.create({ text, mutation_type: 'baseline' }),
    onSuccess: () => {
      toast.success('Prompt created!');
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setCreateDialogOpen(false);
      setNewPromptText('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create prompt');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => promptsApi.delete(id),
    onSuccess: () => {
      toast.success('Prompt deleted');
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete prompt');
    },
  });

  const prompts = data?.prompts || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const filteredPrompts = prompts.filter((p: Prompt) =>
    p.text.toLowerCase().includes(search.toLowerCase())
  );

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, prompt: Prompt) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedPrompt(prompt);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Calculate stats
  const stats = prompts.reduce((acc: any, p: Prompt) => {
    acc.types[p.mutation_type] = (acc.types[p.mutation_type] || 0) + 1;
    acc.avgStability += p.stability_score || 0;
    return acc;
  }, { types: {}, avgStability: 0 });
  
  if (prompts.length > 0) {
    stats.avgStability /= prompts.length;
  }

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Prompts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage all prompts and their mutations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Add Baseline Prompt
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Prompts
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {data?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Baseline Prompts
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {stats.types.baseline || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Mutated Prompts
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {(data?.total || 0) - (stats.types.baseline || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Avg Stability Score
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {stats.avgStability.toFixed(3)}
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
            placeholder="Search prompts..."
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
            {typeFilter ? `Type: ${typeFilter.replace('_', ' ')}` : 'Filter by Type'}
          </Button>
          
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={() => setFilterAnchorEl(null)}
          >
            <MenuItem onClick={() => { setTypeFilter(null); setFilterAnchorEl(null); }}>
              All Types
            </MenuItem>
            {Object.keys(mutationColors).map((type) => (
              <MenuItem 
                key={type}
                onClick={() => { setTypeFilter(type); setFilterAnchorEl(null); }}
              >
                <Chip 
                  size="small" 
                  label={type.replace('_', ' ')}
                  sx={{ 
                    bgcolor: `${mutationColors[type]}20`,
                    color: mutationColors[type],
                    mr: 1,
                  }}
                />
              </MenuItem>
            ))}
          </Menu>
        </CardContent>
      </Card>

      {/* Prompts Table */}
      <TableContainer component={Paper} sx={{ bgcolor: 'background.paper' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '40%' }}>Text</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Stability</TableCell>
              <TableCell align="right">Severity</TableCell>
              <TableCell align="right">Token Count</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredPrompts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">
                    No prompts found
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Add Your First Prompt
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredPrompts.map((prompt: Prompt) => (
                <TableRow
                  key={prompt.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedPrompt(prompt);
                    setViewDialogOpen(true);
                  }}
                >
                  <TableCell>
                    <Tooltip title={prompt.text}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>
                        {prompt.text.slice(0, 100)}{prompt.text.length > 100 ? '...' : ''}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={prompt.mutation_type.replace('_', ' ')}
                      sx={{
                        bgcolor: `${mutationColors[prompt.mutation_type] || '#666'}20`,
                        color: mutationColors[prompt.mutation_type] || '#666',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(prompt.stability_score || 0) * 100}
                        sx={{ width: 60, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="body2" sx={{ minWidth: 45 }}>
                        {(prompt.stability_score || 0).toFixed(3)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {prompt.severity_level?.toFixed(2) || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {prompt.token_count || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, prompt)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
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

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedPrompt) {
            copyToClipboard(selectedPrompt.text);
          }
          handleMenuClose();
        }}>
          <CopyIcon sx={{ mr: 1 }} /> Copy Text
        </MenuItem>
        <MenuItem onClick={() => {
          setViewDialogOpen(true);
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} /> View Details
        </MenuItem>
        <MenuItem onClick={() => {
          setDeleteDialogOpen(true);
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1, color: 'error.main' }} />
          <Typography color="error.main">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* View Prompt Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            Prompt Details
            {selectedPrompt && (
              <Chip
                size="small"
                label={selectedPrompt.mutation_type.replace('_', ' ')}
                sx={{
                  bgcolor: `${mutationColors[selectedPrompt.mutation_type] || '#666'}20`,
                  color: mutationColors[selectedPrompt.mutation_type] || '#666',
                }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPrompt && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Text
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#1a1a1a', mb: 3 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedPrompt.text}
                </Typography>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Stability Score
                  </Typography>
                  <Typography variant="h6">
                    {(selectedPrompt.stability_score || 0).toFixed(4)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Severity Level
                  </Typography>
                  <Typography variant="h6">
                    {selectedPrompt.severity_level?.toFixed(2) || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Token Count
                  </Typography>
                  <Typography variant="h6">
                    {selectedPrompt.token_count || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Experiment ID
                  </Typography>
                  <Typography variant="h6">
                    {selectedPrompt.experiment_id || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              {selectedPrompt.parent_id && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Parent Prompt ID
                  </Typography>
                  <Typography>{selectedPrompt.parent_id}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            if (selectedPrompt) copyToClipboard(selectedPrompt.text);
          }}>
            Copy Text
          </Button>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Prompt Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Baseline Prompt</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Prompt Text"
            value={newPromptText}
            onChange={(e) => setNewPromptText(e.target.value)}
            placeholder="Enter your baseline prompt..."
            multiline
            rows={6}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate(newPromptText)}
            disabled={!newPromptText.trim() || createMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Prompt</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this prompt? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (selectedPrompt) deleteMutation.mutate(selectedPrompt.id);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Prompts;
