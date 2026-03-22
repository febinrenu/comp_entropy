import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Science as ScienceIcon,
  Analytics as AnalyticsIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Bolt as BoltIcon,
  GitHub as GitHubIcon,
  AutoAwesome as SparkleIcon,
  BarChart as ChartIcon,
  Extension as PlaygroundIcon,
  FileDownload as ExportIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  PlayCircle as DemoIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const drawerWidth = 280;

const navItems = [
  { path: '/demo', label: 'Live Demo', icon: <DemoIcon />, section: 'featured', featured: true, emoji: '🔬' },
  { path: '/findings', label: 'Key Findings', icon: <SparkleIcon />, section: 'featured', emoji: '📊' },
  { path: '/', label: 'Dashboard', icon: <DashboardIcon />, section: 'main' },
  { path: '/experiments', label: 'Experiments', icon: <ScienceIcon />, section: 'main' },
  { path: '/prompts', label: 'Prompts', icon: <DescriptionIcon />, section: 'main' },
  { path: '/visualizations', label: 'Visualizations', icon: <ChartIcon />, section: 'analysis' },
  { path: '/playground', label: 'Mutation Lab', icon: <PlaygroundIcon />, section: 'analysis' },
  { path: '/analysis', label: 'Analysis', icon: <AnalyticsIcon />, section: 'analysis' },
  { path: '/export', label: 'Export', icon: <ExportIcon />, section: 'tools' },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon />, section: 'tools' },
];

const sectionLabels: Record<string, string> = {
  featured: 'FEATURED',
  main: 'MAIN',
  analysis: 'ANALYSIS',
  tools: 'TOOLS',
};

interface LayoutProps {
  children: React.ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, darkMode, toggleDarkMode }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Group nav items by section
  const groupedNavItems = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: darkMode 
        ? 'linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, transparent 30%)'
        : 'none',
    }}>
      {/* Logo Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ 
          p: 3, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}>
          <Box
            sx={{
              position: 'relative',
              width: 50,
              height: 50,
            }}
          >
            <Avatar
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                width: 50,
                height: 50,
                boxShadow: `0 0 30px ${alpha('#8b5cf6', 0.5)}`,
                animation: 'pulse 3s ease-in-out infinite',
              }}
            >
              <BoltIcon sx={{ fontSize: 28 }} />
            </Avatar>
            <Box
              sx={{
                position: 'absolute',
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderRadius: '50%',
                border: `2px solid ${alpha('#8b5cf6', 0.3)}`,
                animation: 'ripple 2s ease-out infinite',
              }}
            />
          </Box>
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 800, 
                lineHeight: 1.2,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              Entropy Lab
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <CircleIcon sx={{ fontSize: 8, color: '#10b981', animation: 'pulse 2s ease-in-out infinite' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Research Platform
              </Typography>
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 2, px: 2 }}>
        {Object.entries(groupedNavItems).map(([section, items], sectionIndex) => (
          <Box key={section} sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              sx={{
                px: 2,
                py: 1,
                display: 'block',
                color: 'text.secondary',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {sectionLabels[section]}
            </Typography>
            <List sx={{ p: 0 }}>
              {items.map((item, itemIndex) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && item.path !== '/demo' && location.pathname.startsWith(item.path));
                const isFeatured = (item as any).featured;
                
                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: sectionIndex * 0.1 + itemIndex * 0.05 }}
                  >
                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => {
                          navigate(item.path);
                          if (isMobile) setMobileOpen(false);
                        }}
                        sx={{
                          borderRadius: 3,
                          py: isFeatured ? 1.8 : 1.3,
                          px: 2,
                          position: 'relative',
                          overflow: 'hidden',
                          background: isFeatured 
                            ? `linear-gradient(135deg, ${alpha('#8b5cf6', 0.2)}, ${alpha('#ec4899', 0.2)})`
                            : isActive 
                              ? alpha(theme.palette.primary.main, 0.12) 
                              : 'transparent',
                          border: isFeatured 
                            ? `1px solid ${alpha('#8b5cf6', 0.3)}` 
                            : isActive 
                              ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                              : '1px solid transparent',
                          boxShadow: isFeatured 
                            ? `0 4px 20px ${alpha('#8b5cf6', 0.2)}`
                            : 'none',
                          '&::before': isFeatured ? {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: `linear-gradient(90deg, transparent, ${alpha('#8b5cf6', 0.5)}, transparent)`,
                          } : {},
                          '&:hover': {
                            background: isFeatured
                              ? `linear-gradient(135deg, ${alpha('#8b5cf6', 0.3)}, ${alpha('#ec4899', 0.3)})`
                              : alpha(theme.palette.primary.main, 0.08),
                            transform: 'translateX(4px)',
                            '& .nav-icon': {
                              transform: 'scale(1.1)',
                            },
                          },
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        <ListItemIcon
                          className="nav-icon"
                          sx={{
                            color: isFeatured 
                              ? '#ec4899' 
                              : isActive 
                                ? theme.palette.primary.main 
                                : 'text.secondary',
                            minWidth: 40,
                            transition: 'transform 0.3s ease',
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {(item as any).emoji && (
                                <span style={{ fontSize: '1rem' }}>{(item as any).emoji}</span>
                              )}
                              {item.label}
                            </Box>
                          }
                          primaryTypographyProps={{
                            fontWeight: isFeatured ? 700 : isActive ? 600 : 500,
                            color: isFeatured 
                              ? 'primary.main' 
                              : isActive 
                                ? 'primary.main' 
                                : 'text.primary',
                            fontSize: isFeatured ? '0.95rem' : '0.875rem',
                          }}
                        />
                        {isFeatured && (
                          <Chip 
                            label="NEW" 
                            size="small" 
                            sx={{ 
                              height: 22, 
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                              color: 'white',
                              border: 'none',
                              animation: 'pulse 2s ease-in-out infinite',
                            }} 
                          />
                        )}
                        {isActive && !isFeatured && (
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              boxShadow: `0 0 10px ${theme.palette.primary.main}`,
                            }}
                          />
                        )}
                      </ListItemButton>
                    </ListItem>
                  </motion.div>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha('#8b5cf6', 0.1)}, ${alpha('#06b6d4', 0.1)})`,
              border: `1px solid ${alpha('#8b5cf6', 0.2)}`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${alpha('#8b5cf6', 0.5)}, transparent)`,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SparkleIcon sx={{ fontSize: 18, color: '#8b5cf6' }} />
              <Typography variant="body2" fontWeight={700} sx={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Research Mode
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
              Quantifying semantic entropy in AI systems
            </Typography>
          </Box>
        </motion.div>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{
                  '&:hover': {
                    background: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box>
              <Typography 
                variant="h6" 
                noWrap 
                component="div" 
                sx={{ 
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.01em',
                }}
              >
                Computational Entropy Lab
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                Green Prompt Engineering Research
              </Typography>
            </Box>
            <Chip
              size="small"
              label="v2.0"
              sx={{
                background: `linear-gradient(135deg, ${alpha('#8b5cf6', 0.2)}, ${alpha('#ec4899', 0.2)})`,
                color: 'primary.main',
                fontWeight: 700,
                border: `1px solid ${alpha('#8b5cf6', 0.3)}`,
                display: { xs: 'none', sm: 'flex' },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton 
                color="inherit" 
                size="small" 
                onClick={toggleDarkMode}
                sx={{
                  background: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    background: alpha(theme.palette.primary.main, 0.2),
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.5s ease',
                }}
              >
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="View on GitHub">
              <IconButton 
                color="inherit" 
                size="small"
                sx={{
                  background: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    background: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                <GitHubIcon />
              </IconButton>
            </Tooltip>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: `0 0 20px ${alpha('#06b6d4', 0.4)}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              R
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                background: theme.palette.background.paper,
                borderRight: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                background: theme.palette.background.paper,
                borderRight: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
          position: 'relative',
        }}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </Box>
    </Box>
  );
};

export default Layout;
