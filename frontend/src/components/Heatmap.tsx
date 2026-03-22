import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, useTheme, Tooltip as MuiTooltip } from '@mui/material';

interface HeatmapData {
  x: string;
  y: string;
  value: number;
}

interface EntropyHeatmapProps {
  data?: HeatmapData[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

const defaultData: HeatmapData[] = [
  // Mutation Type vs Energy Level
  { x: 'Baseline', y: 'Low Complexity', value: 0.2 },
  { x: 'Baseline', y: 'Medium Complexity', value: 0.4 },
  { x: 'Baseline', y: 'High Complexity', value: 0.6 },
  { x: 'Synonym', y: 'Low Complexity', value: 0.35 },
  { x: 'Synonym', y: 'Medium Complexity', value: 0.55 },
  { x: 'Synonym', y: 'High Complexity', value: 0.75 },
  { x: 'Paraphrase', y: 'Low Complexity', value: 0.45 },
  { x: 'Paraphrase', y: 'Medium Complexity', value: 0.65 },
  { x: 'Paraphrase', y: 'High Complexity', value: 0.85 },
  { x: 'Simplify', y: 'Low Complexity', value: 0.15 },
  { x: 'Simplify', y: 'Medium Complexity', value: 0.3 },
  { x: 'Simplify', y: 'High Complexity', value: 0.5 },
  { x: 'Elaborate', y: 'Low Complexity', value: 0.5 },
  { x: 'Elaborate', y: 'Medium Complexity', value: 0.7 },
  { x: 'Elaborate', y: 'High Complexity', value: 0.95 },
  { x: 'Formal', y: 'Low Complexity', value: 0.3 },
  { x: 'Formal', y: 'Medium Complexity', value: 0.5 },
  { x: 'Formal', y: 'High Complexity', value: 0.7 },
];

const EntropyHeatmap: React.FC<EntropyHeatmapProps> = ({
  data = defaultData,
  title = '🔥 Energy Consumption Heatmap',
  xLabel = 'Mutation Type',
  yLabel = 'Prompt Complexity',
}) => {
  const theme = useTheme();

  const { xValues, yValues, matrix, maxValue, minValue } = useMemo(() => {
    const xSet = new Set(data.map((d) => d.x));
    const ySet = new Set(data.map((d) => d.y));
    const xValues = Array.from(xSet);
    const yValues = Array.from(ySet);

    const matrix: (number | null)[][] = yValues.map((y) =>
      xValues.map((x) => {
        const item = data.find((d) => d.x === x && d.y === y);
        return item ? item.value : null;
      })
    );

    const values = data.map((d) => d.value);
    return {
      xValues,
      yValues,
      matrix,
      maxValue: Math.max(...values),
      minValue: Math.min(...values),
    };
  }, [data]);

  const getColor = (value: number | null): string => {
    if (value === null) return theme.palette.grey[800];
    const normalized = (value - minValue) / (maxValue - minValue);
    
    // Color gradient from blue (low) to yellow (medium) to red (high)
    if (normalized < 0.5) {
      const t = normalized * 2;
      return `rgb(${Math.round(66 + t * (255 - 66))}, ${Math.round(126 + t * (193 - 126))}, ${Math.round(234 - t * (234 - 7))})`;
    } else {
      const t = (normalized - 0.5) * 2;
      return `rgb(${Math.round(255 - t * (255 - 239))}, ${Math.round(193 - t * (193 - 68))}, ${Math.round(7 + t * (68 - 7))})`;
    }
  };

  const cellSize = 70;
  const labelWidth = 120;
  const labelHeight = 40;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          {title}
        </Typography>
        
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 2,
            overflowX: 'auto',
          }}
        >
          {/* X-axis label */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
            {xLabel}
          </Typography>

          {/* X-axis headers */}
          <Box sx={{ display: 'flex', ml: `${labelWidth}px` }}>
            {xValues.map((x) => (
              <Box
                key={x}
                sx={{
                  width: cellSize,
                  height: labelHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    transform: 'rotate(-45deg)',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {x}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Heatmap grid */}
          <Box sx={{ display: 'flex' }}>
            {/* Y-axis labels */}
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {yValues.map((y) => (
                <Box
                  key={y}
                  sx={{
                    width: labelWidth,
                    height: cellSize,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 1,
                  }}
                >
                  <Typography variant="caption" fontWeight={500}>
                    {y}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Cells */}
            <Box>
              {matrix.map((row, yIndex) => (
                <Box key={yIndex} sx={{ display: 'flex' }}>
                  {row.map((value, xIndex) => (
                    <MuiTooltip
                      key={`${xIndex}-${yIndex}`}
                      title={
                        <Box>
                          <Typography variant="body2">
                            <strong>{xValues[xIndex]}</strong> × <strong>{yValues[yIndex]}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Energy: {value !== null ? (value * 100).toFixed(1) : 'N/A'} J
                          </Typography>
                        </Box>
                      }
                      arrow
                    >
                      <Box
                        sx={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: getColor(value),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${theme.palette.divider}`,
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            zIndex: 1,
                            boxShadow: 4,
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: value !== null && value > 0.6 ? 'white' : 'black',
                          }}
                        >
                          {value !== null ? (value * 100).toFixed(0) : '-'}
                        </Typography>
                      </Box>
                    </MuiTooltip>
                  ))}
                </Box>
              ))}
            </Box>

            {/* Y-axis label */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                ml: 2,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                {yLabel}
              </Typography>
            </Box>
          </Box>

          {/* Color legend */}
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Low Energy
            </Typography>
            <Box
              sx={{
                width: 200,
                height: 16,
                borderRadius: 1,
                background: `linear-gradient(90deg, 
                  rgb(66, 126, 234) 0%, 
                  rgb(255, 193, 7) 50%, 
                  rgb(239, 68, 68) 100%)`,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              High Energy
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Correlation Matrix Component
interface CorrelationMatrixProps {
  title?: string;
}

const defaultCorrelations = [
  ['', 'Energy', 'Tokens', 'Time', 'Power', 'Complexity'],
  ['Energy', 1.0, 0.87, 0.92, 0.95, 0.72],
  ['Tokens', 0.87, 1.0, 0.78, 0.83, 0.68],
  ['Time', 0.92, 0.78, 1.0, 0.88, 0.65],
  ['Power', 0.95, 0.83, 0.88, 1.0, 0.7],
  ['Complexity', 0.72, 0.68, 0.65, 0.7, 1.0],
];

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  title = '🔗 Variable Correlation Matrix',
}) => {
  const theme = useTheme();

  const getCorrelationColor = (value: number): string => {
    if (value === 1) return theme.palette.primary.main;
    const intensity = Math.abs(value);
    if (value > 0) {
      return `rgba(76, 175, 80, ${intensity})`;
    }
    return `rgba(244, 67, 54, ${intensity})`;
  };

  const cellSize = 60;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, overflowX: 'auto' }}>
          <Box>
            {defaultCorrelations.map((row, rowIndex) => (
              <Box key={rowIndex} sx={{ display: 'flex' }}>
                {row.map((cell, colIndex) => {
                  const isHeader = rowIndex === 0 || colIndex === 0;
                  const value = typeof cell === 'number' ? cell : null;

                  return (
                    <MuiTooltip
                      key={`${rowIndex}-${colIndex}`}
                      title={
                        value !== null && rowIndex > 0 && colIndex > 0 ? (
                          <Typography variant="body2">
                            Correlation: {value.toFixed(2)}
                          </Typography>
                        ) : (
                          ''
                        )
                      }
                      arrow
                    >
                      <Box
                        sx={{
                          width: cellSize,
                          height: cellSize,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isHeader
                            ? 'transparent'
                            : getCorrelationColor(value || 0),
                          border: `1px solid ${theme.palette.divider}`,
                          fontWeight: isHeader ? 600 : 400,
                          cursor: value !== null ? 'pointer' : 'default',
                          transition: 'transform 0.2s',
                          '&:hover': value !== null
                            ? {
                                transform: 'scale(1.05)',
                                zIndex: 1,
                              }
                            : {},
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: isHeader ? 600 : 500,
                            color: value !== null && value > 0.7 ? 'white' : 'inherit',
                          }}
                        >
                          {typeof cell === 'number' ? cell.toFixed(2) : cell}
                        </Typography>
                      </Box>
                    </MuiTooltip>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 3 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'success.main', borderRadius: 1 }} />
            <Typography variant="caption">Positive correlation</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'error.main', borderRadius: 1 }} />
            <Typography variant="caption">Negative correlation</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EntropyHeatmap;
