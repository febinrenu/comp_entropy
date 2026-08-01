import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  Chip,
  Alert,
} from '@mui/material';
import { motion } from 'framer-motion';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card sx={{ mb: 3 }}>
    <CardContent>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </CardContent>
  </Card>
);

const About: React.FC = () => {
  return (
    <Box>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Research Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            What this platform measures, why it matters, and exactly how each number is produced.
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={0}>
        <Grid item xs={12} lg={8}>
          <Section title="The research question">
            <Typography variant="body1" paragraph>
              Large language model inference has a real, measurable energy cost, and that cost
              is typically discussed in terms of model size, hardware, or batch configuration.
              This platform investigates a different variable: <strong>the prompt itself</strong>.
              Specifically, it tests whether prompts that are harder to interpret — more
              ambiguous, more contradictory, more verbose, noisier — cause a language model to
              consume measurably more energy per generated token than a clear, well-formed
              equivalent.
            </Typography>
            <Typography variant="body1" paragraph>
              We call this quantity the <strong>Semantic Instability Index (SII)</strong>, and
              we test its relationship to <strong>Energy Per Token (EPT)</strong> via the{' '}
              <strong>Prompt Entropy Coefficient (PEC)</strong> — the Spearman rank correlation
              between the two, computed across real experiment measurements.
            </Typography>
          </Section>

          <Section title="Why it matters">
            <Typography variant="body1" paragraph>
              If the relationship holds up under real measurement, it has direct practical
              consequences: prompt-engineering guidance that treats energy cost as a design
              constraint, automated pre-submission checks that flag unusually unstable prompts
              at high query volumes, and a cheap, computable leading indicator (SII) for
              inference-cost drift in a production system — independent of model size or
              hardware choice, both of which are typically the only levers considered.
            </Typography>
          </Section>

          <Section title="How a measurement is produced">
            <Typography variant="body1" paragraph>
              <strong>1. Mutation Engine.</strong> A base prompt is transformed under one of nine
              conditions: <em>baseline</em> (unchanged), <em>typo noise</em>, <em>verbose
              filler</em>, <em>semantic ambiguity</em>, <em>logical contradiction</em>,{' '}
              <em>negation</em>, <em>sentence/word reordering</em>, <em>formality shift</em>, and{' '}
              <em>code-switching</em> (foreign-phrase insertion), at a configurable intensity.
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>2. SII computation.</strong> Each mutated prompt gets a Semantic Instability
              Index: a per-condition base score (a hand-tuned table, not empirically derived from
              prior measurement — see Limitations) plus adjustments for how far the mutated
              prompt's readability, lexical diversity, and sentence length deviate from the
              baseline's own values.
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>3. Generation.</strong> The (possibly mutated) prompt is sent to a real
              language model. The default provider is a locally-served <strong>Ollama</strong>{' '}
              model; OpenAI and Anthropic are available as alternate providers given an API key.
              A <em>simulation</em> mode also exists as an explicit, clearly-labeled synthetic
              fallback for testing without any model available — its output is never presented as
              a real measurement.
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>4. Energy measurement.</strong> Every measurement records exactly where its
              energy figure came from:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li>
                <Typography variant="body2">
                  <Chip label="nvml_real" size="small" color="success" sx={{ mr: 1 }} />
                  Real GPU power draw, sampled from NVIDIA's NVML interface throughout the
                  generation call and integrated over time — genuine hardware wattage, not an
                  estimate.
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <Chip label="tdp_proxy" size="small" color="warning" sx={{ mr: 1 }} />
                  CPU and RAM power are <strong>always</strong> modeled estimates on this
                  platform (CPU-utilization × nominal TDP; a flat per-GB RAM heuristic) — there is
                  no RAPL or other real CPU hardware-energy access available in this environment.
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <Chip label="synthetic_simulation" size="small" color="default" sx={{ mr: 1 }} />
                  A hand-tuned heuristic used only when no real provider/model is available.
                  Explicitly synthetic — not a measurement of anything.
                </Typography>
              </li>
            </Box>
            <Typography variant="body1" paragraph>
              <strong>5. Statistics.</strong> Results are analyzed with Spearman/Pearson/Kendall
              correlation and bootstrap or Fisher-z confidence intervals, one-way ANOVA with
              Kruskal-Wallis corroboration, and effect sizes (Cohen's d, Hedges' g, η², ω²) — see
              the Analysis and Research Findings pages for real, per-experiment results.
            </Typography>
          </Section>

          <Section title="Limitations, stated plainly">
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <li>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  The SII base-score table is a hand-picked constant, not derived from prior
                  measurement. Treat any SII-EPT correlation as a hypothesis under test, not a
                  confirmed relationship, until validated against a real held-out dataset.
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  CPU/RAM energy is always an estimate on this platform — there is no real
                  hardware CPU energy source available (no RAPL access). Only the GPU component
                  can be a genuine hardware measurement, and only when NVML detects a GPU.
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  Measurements reflect a single machine's hardware and software stack. No claim
                  is made about generalizing absolute energy figures across different hardware —
                  only relative comparisons across mutation conditions on the same machine are
                  well-supported.
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  The Demo page's single-prompt runs are illustrative, not statistically valid —
                  a real result requires the sample sizes and significance testing on the
                  Research Findings and Analysis pages.
                </Typography>
              </li>
            </Box>
          </Section>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3, position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                At a glance
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Hypothesis under test</Typography>
                  <Typography variant="body2">SII correlates with EPT (Spearman ρ, PEC)</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Mutation conditions</Typography>
                  <Typography variant="body2">9 (baseline + 8 controlled perturbations)</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Default generation backend</Typography>
                  <Typography variant="body2">Ollama (local, real model)</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Real hardware energy source</Typography>
                  <Typography variant="body2">NVIDIA NVML (GPU only)</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Alert severity="info">
            Every measurement in this app carries a <code>measurement_source</code> field
            (<code>nvml_real</code> / <code>tdp_proxy</code> / <code>synthetic_simulation</code>)
            so you can always tell what actually produced a given number — see it on the
            Research Findings and Measurements pages.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

export default About;
