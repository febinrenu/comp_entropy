import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, alpha } from '@mui/material';
import { motion, useSpring, useTransform } from 'framer-motion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

interface AnimatedStatsCardProps {
  title: string;
  value: number;
  suffix?: string;
  prefix?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  decimals?: number;
  gradient?: string;
}

const AnimatedNumber: React.FC<{ value: number; decimals?: number }> = ({ value, decimals = 0 }) => {
  const spring = useSpring(0, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (current) => current.toFixed(decimals));
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    spring.set(value);
    const unsubscribe = display.on('change', (v) => setDisplayValue(v));
    return () => unsubscribe();
  }, [value, spring, display]);

  return <span>{displayValue}</span>;
};

const AnimatedStatsCard: React.FC<AnimatedStatsCardProps> = ({
  title,
  value,
  suffix = '',
  prefix = '',
  icon,
  color,
  trend,
  decimals = 0,
  gradient,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
    >
      <Card
        sx={{
          height: '100%',
          background: gradient || `linear-gradient(135deg, ${alpha(color, 0.12)} 0%, ${alpha(color, 0.04)} 100%)`,
          borderLeft: `4px solid ${color}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '150px',
            height: '150px',
            background: `radial-gradient(circle, ${alpha(color, 0.2)} 0%, transparent 70%)`,
            transform: 'translate(30%, -30%)',
          },
          '&:hover': {
            boxShadow: `0 20px 40px ${alpha(color, 0.25)}, 0 0 60px ${alpha(color, 0.1)}`,
          },
        }}
      >
        <CardContent sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography
                variant="overline"
                sx={{ 
                  fontWeight: 600, 
                  letterSpacing: '0.1em',
                  color: alpha('#fff', 0.6),
                }}
              >
                {title}
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  mt: 0.5,
                  background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.5,
                  letterSpacing: '-0.02em',
                }}
              >
                {prefix}
                <AnimatedNumber value={value} decimals={decimals} />
                <Typography 
                  component="span" 
                  variant="body1" 
                  sx={{ 
                    ml: 0.5,
                    color: alpha(color, 0.8),
                    fontWeight: 600,
                  }}
                >
                  {suffix}
                </Typography>
              </Typography>
              {trend !== undefined && (
                <Box 
                  sx={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    mt: 1.5,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                    bgcolor: trend >= 0 ? alpha('#10b981', 0.15) : alpha('#ef4444', 0.15),
                  }}
                >
                  {trend >= 0 ? (
                    <TrendingUpIcon sx={{ color: '#10b981', fontSize: 16 }} />
                  ) : (
                    <TrendingDownIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      ml: 0.5,
                      color: trend >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: 700,
                    }}
                  >
                    {trend >= 0 ? '+' : ''}
                    {trend.toFixed(1)}%
                  </Typography>
                </Box>
              )}
            </Box>
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.05, 1.05, 1],
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
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
            </motion.div>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AnimatedStatsCard;
