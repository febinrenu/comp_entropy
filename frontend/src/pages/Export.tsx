import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Paper,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
  Article as LatexIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { experimentsApi, exportApi } from '../services/api';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  formats: string[];
}

const exportOptions: ExportOption[] = [
  {
    id: 'experiment',
    label: 'Full Experiment',
    description: 'Export complete experiment data including all measurements and analysis',
    icon: <DownloadIcon />,
    formats: ['csv', 'json'],
  },
  {
    id: 'measurements',
    label: 'Measurements Only',
    description: 'Export raw measurement data for external analysis',
    icon: <CsvIcon />,
    formats: ['csv', 'json'],
  },
  {
    id: 'analysis',
    label: 'Analysis Report',
    description: 'Export statistical analysis results and visualizations',
    icon: <PdfIcon />,
    formats: ['json', 'latex'],
  },
  {
    id: 'prompts',
    label: 'Prompts Dataset',
    description: 'Export all prompts with their mutations and stability scores',
    icon: <JsonIcon />,
    formats: ['csv', 'json'],
  },
  {
    id: 'reproducibility',
    label: 'Reproducibility Package',
    description: 'Export full bundle with protocols, replication summaries, and raw data',
    icon: <DownloadIcon />,
    formats: ['zip'],
  },
];

const Export: React.FC = () => {
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(null);
  const [selectedExport, setSelectedExport] = useState<string>('experiment');
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  const [includeOptions, setIncludeOptions] = useState({
    measurements: true,
    prompts: true,
    analysis: true,
    metadata: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: experiments } = useQuery({
    queryKey: ['experiments-export'],
    queryFn: () => experimentsApi.list(1, 100).then(res => res.data),
  });

  const currentOption = exportOptions.find(o => o.id === selectedExport);

  const handleExport = async () => {
    if (!selectedExperiment) {
      toast.error('Please select an experiment');
      return;
    }

    setIsExporting(true);
    try {
      let url: string;
      let filename: string;

      switch (selectedExport) {
        case 'experiment':
        case 'measurements':
          url = exportApi.downloadCSV(selectedExperiment, selectedExport === 'experiment' ? 'all' : 'measurements');
          filename = `${selectedExport}_${selectedExperiment}.${selectedFormat}`;
          break;
        case 'analysis':
          url = exportApi.downloadLatex(selectedExperiment);
          filename = `analysis_${selectedExperiment}.tex`;
          break;
        case 'prompts':
          url = exportApi.downloadJSON(selectedExperiment);
          filename = `prompts_${selectedExperiment}.json`;
          break;
        case 'reproducibility':
          url = exportApi.downloadReproducibility(selectedExperiment);
          filename = `reproducibility_${selectedExperiment}.zip`;
          break;
        default:
          throw new Error('Invalid export type');
      }

      // Open in new tab to trigger download
      window.open(url, '_blank');
      toast.success(`Export started: ${filename}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedExp = experiments?.experiments?.find((e: any) => e.id === selectedExperiment);

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Export Data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Export your research data in various formats for publication and analysis
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Export Configuration */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Export Configuration
              </Typography>

              {/* Experiment Selector */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Select Experiment</InputLabel>
                <Select
                  value={selectedExperiment || ''}
                  label="Select Experiment"
                  onChange={(e) => setSelectedExperiment(e.target.value as number)}
                >
                  {experiments?.experiments?.map((exp: any) => (
                    <MenuItem key={exp.id} value={exp.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {exp.name}
                        <Chip 
                          size="small" 
                          label={exp.status}
                          color={exp.status === 'completed' ? 'success' : 'default'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          ({exp.total_measurements} measurements)
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider sx={{ my: 3 }} />

              {/* Export Type Selection */}
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                What to Export
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {exportOptions.map((option) => (
                  <Grid item xs={12} sm={6} key={option.id}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderColor: selectedExport === option.id ? 'primary.main' : 'divider',
                        bgcolor: selectedExport === option.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        '&:hover': {
                          borderColor: 'primary.main',
                        },
                      }}
                      onClick={() => {
                        setSelectedExport(option.id);
                        setSelectedFormat(option.formats[0]);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ color: 'primary.main' }}>{option.icon}</Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {option.label}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Format Selection */}
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Export Format
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {currentOption?.formats.map((format) => (
                  <Grid item xs={6} sm={3} key={format}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        borderColor: selectedFormat === format ? 'primary.main' : 'divider',
                        bgcolor: selectedFormat === format ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        '&:hover': {
                          borderColor: 'primary.main',
                        },
                      }}
                      onClick={() => setSelectedFormat(format)}
                    >
                      {format === 'csv' && <CsvIcon sx={{ fontSize: 32, mb: 1, color: 'success.main' }} />}
                      {format === 'json' && <JsonIcon sx={{ fontSize: 32, mb: 1, color: 'warning.main' }} />}
                      {format === 'pdf' && <PdfIcon sx={{ fontSize: 32, mb: 1, color: 'error.main' }} />}
                      {format === 'latex' && <LatexIcon sx={{ fontSize: 32, mb: 1, color: 'info.main' }} />}
                      {format === 'zip' && <DownloadIcon sx={{ fontSize: 32, mb: 1, color: 'secondary.main' }} />}
                      <Typography variant="subtitle2" textTransform="uppercase" fontWeight={600}>
                        {format}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {selectedExport === 'experiment' && (
                <>
                  <Divider sx={{ my: 3 }} />
                  
                  {/* Include Options */}
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Include in Export
                  </Typography>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeOptions.measurements}
                          onChange={(e) => setIncludeOptions(prev => ({ ...prev, measurements: e.target.checked }))}
                        />
                      }
                      label="Measurements"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeOptions.prompts}
                          onChange={(e) => setIncludeOptions(prev => ({ ...prev, prompts: e.target.checked }))}
                        />
                      }
                      label="Prompts"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeOptions.analysis}
                          onChange={(e) => setIncludeOptions(prev => ({ ...prev, analysis: e.target.checked }))}
                        />
                      }
                      label="Analysis Results"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeOptions.metadata}
                          onChange={(e) => setIncludeOptions(prev => ({ ...prev, metadata: e.target.checked }))}
                        />
                      }
                      label="Metadata"
                    />
                  </FormGroup>
                </>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Export Button */}
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                onClick={handleExport}
                disabled={!selectedExperiment || isExporting}
              >
                {isExporting ? 'Exporting...' : `Export as ${selectedFormat.toUpperCase()}`}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Preview / Info */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Export Preview
              </Typography>

              {selectedExperiment && selectedExp ? (
                <Box>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      Experiment
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {selectedExp.name}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Box>
                      <Chip
                        size="small"
                        label={selectedExp.status}
                        color={selectedExp.status === 'completed' ? 'success' : 'default'}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      Total Measurements
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>
                      {selectedExp.total_measurements.toLocaleString()}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Estimated File Size
                  </Typography>
                  <Typography variant="body2">
                    ~{Math.ceil(selectedExp.total_measurements * (selectedFormat === 'json' ? 0.5 : 0.1))} KB
                  </Typography>

                  {selectedFormat === 'latex' && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      LaTeX export includes publication-ready tables and figures compatible with major journals.
                    </Alert>
                  )}

                  {selectedFormat === 'pdf' && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      PDF report includes visualizations, statistical analysis, and formatted results.
                    </Alert>
                  )}

                  {selectedFormat === 'zip' && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      ZIP bundle includes raw data, replication summaries, and the human-rater appendix protocol.
                    </Alert>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <DownloadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">
                    Select an experiment to preview export details
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Export Tips */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Export Tips
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Use <strong>CSV</strong> for spreadsheet analysis
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Use <strong>JSON</strong> for programmatic access
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Use <strong>PDF</strong> for reports and presentations
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Use <strong>LaTeX</strong> for academic papers
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Use <strong>ZIP</strong> for full reproducibility packages
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Export;

