"""
Energy Monitor
==============

Real-time energy consumption monitoring using CodeCarbon
and direct hardware interfaces.
"""

import time
import threading
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
import psutil
from app.core.logger import logger

from app.core.config import settings


@dataclass
class EnergyReading:
    """Single energy reading snapshot."""
    timestamp: float
    cpu_power_watts: float = 0.0
    gpu_power_watts: float = 0.0
    ram_power_watts: float = 0.0
    total_power_watts: float = 0.0
    cpu_utilization: float = 0.0
    gpu_utilization: float = 0.0
    gpu_memory_mb: float = 0.0
    gpu_temp_c: float = 0.0
    ram_used_mb: float = 0.0


class EnergyMonitor:
    """
    Energy monitoring system for LLM inference.
    
    Combines multiple data sources:
    - CodeCarbon for calibrated energy estimates
    - Direct GPU monitoring via pynvml
    - CPU monitoring via psutil
    """
    
    # Estimated power consumption factors (configurable)
    CPU_TDP_WATTS = 65  # Typical desktop CPU
    RAM_POWER_PER_GB_WATTS = 3  # Approximate
    GPU_IDLE_WATTS = 15  # Typical idle power
    
    def __init__(self):
        """Initialize the energy monitor."""
        self.is_monitoring = False
        self.readings: list = []
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        
        # CodeCarbon tracker
        self.tracker = None
        self.codecarbon_available = False
        
        # GPU monitoring
        self.nvml_available = False
        self.gpu_handle = None
        
        self._init_codecarbon()
        self._init_nvml()
    
    def _init_codecarbon(self):
        """Initialize CodeCarbon tracker."""
        try:
            from codecarbon import EmissionsTracker
            self.codecarbon_available = True
            logger.info("CodeCarbon available for energy tracking")
        except ImportError:
            logger.warning("CodeCarbon not available, using estimates")
    
    def _init_nvml(self):
        """Initialize NVIDIA Management Library."""
        try:
            import pynvml
            pynvml.nvmlInit()
            self.nvml_available = True
            
            # Get first GPU handle
            device_count = pynvml.nvmlDeviceGetCount()
            if device_count > 0:
                self.gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                gpu_name = pynvml.nvmlDeviceGetName(self.gpu_handle)
                logger.info(f"NVML initialized: {gpu_name}")
        except Exception as e:
            logger.warning(f"NVML not available: {e}")
    
    def start(self):
        """Start energy monitoring."""
        self.is_monitoring = True
        self.readings = []
        self.start_time = time.time()
        
        # Start CodeCarbon if available
        if self.codecarbon_available:
            try:
                from codecarbon import EmissionsTracker
                self.tracker = EmissionsTracker(
                    project_name="comp_entropy",
                    measure_power_secs=settings.ENERGY_MEASUREMENT_INTERVAL,
                    tracking_mode="process",
                    log_level="error",
                    save_to_file=False
                )
                self.tracker.start()
            except Exception as e:
                logger.warning(f"Failed to start CodeCarbon: {e}")
        
        # Start background monitoring thread
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
    
    def _monitor_loop(self):
        """Background monitoring loop."""
        while self.is_monitoring:
            try:
                reading = self._take_reading()
                self.readings.append(reading)
            except Exception as e:
                logger.warning(f"Error taking reading: {e}")
            
            time.sleep(settings.ENERGY_MEASUREMENT_INTERVAL)
    
    def _take_reading(self) -> EnergyReading:
        """Take a single energy reading."""
        reading = EnergyReading(timestamp=time.time())
        
        # CPU monitoring
        reading.cpu_utilization = psutil.cpu_percent()
        reading.cpu_power_watts = (reading.cpu_utilization / 100) * self.CPU_TDP_WATTS
        
        # RAM monitoring
        ram = psutil.virtual_memory()
        reading.ram_used_mb = ram.used / (1024 ** 2)
        ram_gb = ram.used / (1024 ** 3)
        reading.ram_power_watts = ram_gb * self.RAM_POWER_PER_GB_WATTS
        
        # GPU monitoring
        if self.nvml_available and self.gpu_handle:
            try:
                import pynvml
                
                # Power
                power_mw = pynvml.nvmlDeviceGetPowerUsage(self.gpu_handle)
                reading.gpu_power_watts = power_mw / 1000
                
                # Utilization
                util = pynvml.nvmlDeviceGetUtilizationRates(self.gpu_handle)
                reading.gpu_utilization = util.gpu
                
                # Memory
                mem = pynvml.nvmlDeviceGetMemoryInfo(self.gpu_handle)
                reading.gpu_memory_mb = mem.used / (1024 ** 2)
                
                # Temperature
                reading.gpu_temp_c = pynvml.nvmlDeviceGetTemperature(
                    self.gpu_handle, pynvml.NVML_TEMPERATURE_GPU
                )
            except Exception:
                pass
        else:
            # Estimate GPU power based on typical values
            reading.gpu_power_watts = self.GPU_IDLE_WATTS
        
        reading.total_power_watts = (
            reading.cpu_power_watts + 
            reading.gpu_power_watts + 
            reading.ram_power_watts
        )
        
        return reading
    
    def stop(self) -> Dict[str, Any]:
        """Stop monitoring and return aggregated results."""
        self.is_monitoring = False
        self.end_time = time.time()
        
        # Stop CodeCarbon
        codecarbon_energy = 0.0
        codecarbon_carbon = 0.0
        
        if self.codecarbon_available and self.tracker:
            try:
                emissions = self.tracker.stop()
                codecarbon_energy = getattr(self.tracker, '_total_energy', 0) or 0
                codecarbon_carbon = emissions or 0
            except Exception as e:
                logger.warning(f"Error stopping CodeCarbon: {e}")
        
        # Calculate from readings
        if not self.readings:
            return self._empty_result()
        
        duration = self.end_time - self.start_time
        
        # Aggregate readings
        avg_power = sum(r.total_power_watts for r in self.readings) / len(self.readings)
        peak_power = max(r.total_power_watts for r in self.readings)
        
        avg_cpu_power = sum(r.cpu_power_watts for r in self.readings) / len(self.readings)
        avg_gpu_power = sum(r.gpu_power_watts for r in self.readings) / len(self.readings)
        avg_ram_power = sum(r.ram_power_watts for r in self.readings) / len(self.readings)
        
        # Energy = Power × Time (convert to Joules)
        total_energy = avg_power * duration
        cpu_energy = avg_cpu_power * duration
        gpu_energy = avg_gpu_power * duration
        ram_energy = avg_ram_power * duration
        
        # Use CodeCarbon values if available (more accurate)
        if codecarbon_energy > 0:
            total_energy = codecarbon_energy * 3600000  # kWh to Joules
        
        # Carbon estimation
        if codecarbon_carbon > 0:
            carbon_kg = codecarbon_carbon
        else:
            # Estimate: ~0.4 kg CO2 per kWh (US average)
            carbon_kg = (total_energy / 3600000) * 0.4
        
        # Get latest hardware state
        last = self.readings[-1]
        
        return {
            "total_energy_joules": total_energy,
            "cpu_energy_joules": cpu_energy,
            "gpu_energy_joules": gpu_energy,
            "ram_energy_joules": ram_energy,
            "avg_power_watts": avg_power,
            "peak_power_watts": peak_power,
            "duration_seconds": duration,
            "carbon_kg": carbon_kg,
            "num_readings": len(self.readings),
            
            # Latest state
            "cpu_utilization": last.cpu_utilization,
            "gpu_utilization": last.gpu_utilization,
            "gpu_memory_mb": last.gpu_memory_mb,
            "gpu_temp_c": last.gpu_temp_c,
            "ram_used_mb": last.ram_used_mb
        }
    
    def _empty_result(self) -> Dict[str, Any]:
        """Return empty result when no readings available."""
        return {
            "total_energy_joules": 0,
            "cpu_energy_joules": 0,
            "gpu_energy_joules": 0,
            "ram_energy_joules": 0,
            "avg_power_watts": 0,
            "peak_power_watts": 0,
            "duration_seconds": 0,
            "carbon_kg": 0,
            "num_readings": 0,
            "cpu_utilization": 0,
            "gpu_utilization": 0,
            "gpu_memory_mb": 0,
            "gpu_temp_c": 0,
            "ram_used_mb": 0
        }
    
    def get_realtime_stats(self) -> Dict[str, Any]:
        """Get current real-time statistics."""
        reading = self._take_reading()
        return {
            "timestamp": reading.timestamp,
            "power_watts": reading.total_power_watts,
            "cpu_power_watts": reading.cpu_power_watts,
            "gpu_power_watts": reading.gpu_power_watts,
            "cpu_utilization": reading.cpu_utilization,
            "gpu_utilization": reading.gpu_utilization,
            "gpu_memory_mb": reading.gpu_memory_mb,
            "gpu_temp_c": reading.gpu_temp_c
        }


# Singleton instance
energy_monitor = EnergyMonitor()
