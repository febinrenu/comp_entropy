import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Experiments from './pages/Experiments';
import ExperimentDetail from './pages/ExperimentDetail';
import NewExperiment from './pages/NewExperiment';
import Analysis from './pages/Analysis';
import Prompts from './pages/Prompts';
import Measurements from './pages/Measurements';
import Export from './pages/Export';
import Settings from './pages/Settings';
import Visualizations from './pages/Visualizations';
import Playground from './pages/Playground';
import Demo from './pages/Demo';
import Findings from './pages/Findings';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const theme = useMemo(() => getTheme(mode), [mode]);

  // Update CSS variables for theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleDarkMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Layout darkMode={mode === 'dark'} toggleDarkMode={toggleDarkMode}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/experiments/new" element={<NewExperiment />} />
            <Route path="/experiments/:id" element={<ExperimentDetail />} />
            <Route path="/prompts" element={<Prompts />} />
            <Route path="/measurements" element={<Measurements />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/visualizations" element={<Visualizations />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/export" element={<Export />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </Box>
    </ThemeProvider>
  );
}

export default App;
