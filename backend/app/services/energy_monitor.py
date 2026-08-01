"""
Energy Monitor
==============

Energy consumption monitoring for LLM inference, combining:
- Real GPU power draw via NVIDIA NVML (pynvml), when available -- this is
  genuine hardware-reported wattage, not an estimate.
- Optional CodeCarbon cross-check (uses its public stop() return value
  only; does not reach into private/internal attributes).
- A CPU-time x TDP proxy fallback, explicitly labeled as an estimate, for
  when no GPU/NVML is available.

Every reading and every aggregated result carries an explicit source label
per component (`"nvml_real"` / `"tdp_proxy_estimate"` / `"idle_estimate"`)
so a caller can tell real hardware measurement from a modeled estimate --
they are never silently blended into one number without that distinction.
"""

import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import psutil

from app.core.config import settings
from app.core.logger import logger


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
    gpu_power_source: str = "idle_estimate"


class EnergyMonitor:
    """
    Energy monitoring system for LLM inference.

    CPU and RAM power are always modeled estimates on this platform (no
    RAPL/hardware CPU energy access). GPU power is real NVML wattage when
    a GPU is present and `settings.ENABLE_GPU_MONITORING` is true;
    otherwise it falls back to a flat idle-watts estimate, explicitly
    labeled as such.
    """

    RAM_POWER_PER_GB_WATTS = 3  # Approximate, not a real measurement
    GPU_IDLE_WATTS = 15  # Fallback estimate when NVML/GPU is unavailable

    def __init__(self):
        """Initialize the energy monitor."""
        self.is_monitoring = False
        self.readings: list = []
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self._readings_lock = threading.Lock()
        self._monitor_thread: Optional[threading.Thread] = None

        # CodeCarbon tracker
        self.tracker = None
        self.codecarbon_available = False

        # GPU monitoring
        self.nvml_available = False
        self.gpu_handle = None

        self._init_codecarbon()
        if settings.ENABLE_GPU_MONITORING:
            self._init_nvml()
        else:
            logger.info("GPU monitoring disabled via ENABLE_GPU_MONITORING=False")

    def _init_codecarbon(self):
        """Initialize CodeCarbon tracker."""
        try:
            from codecarbon import EmissionsTracker  # noqa: F401
            self.codecarbon_available = True
            logger.info("CodeCarbon available for energy tracking")
        except ImportError:
            logger.warning("CodeCarbon not available, using estimates")

    def _init_nvml(self):
        """Initialize NVIDIA Management Library. Only marks nvml_available
        True once a real GPU handle is actually obtained -- previously this
        flag was set True right after nvmlInit() succeeded, even with zero
        GPUs present, which misreported availability."""
        try:
            import pynvml
            pynvml.nvmlInit()

            device_count = pynvml.nvmlDeviceGetCount()
            if device_count > 0:
                self.gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                gpu_name = pynvml.nvmlDeviceGetName(self.gpu_handle)
                self.nvml_available = True
                logger.info(f"NVML initialized: {gpu_name}")
            else:
                logger.warning("NVML initialized but no GPU devices found")
        except Exception as e:
            logger.warning(f"NVML not available: {e}")

    def shutdown(self):
        """Release the NVML handle. Call once at process shutdown (e.g.
        from the FastAPI lifespan/shutdown event) -- NVML stays
        initialized for the life of the process otherwise, which is fine
        for a long-running server but should still be released on exit."""
        if self.nvml_available:
            try:
                import pynvml
                pynvml.nvmlShutdown()
            except Exception as e:
                logger.warning(f"Error shutting down NVML: {e}")
            finally:
                self.nvml_available = False
                self.gpu_handle = None
    
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
                with self._readings_lock:
                    self.readings.append(reading)
            except Exception as e:
                logger.warning(f"Error taking reading: {e}")

            time.sleep(settings.ENERGY_MEASUREMENT_INTERVAL)

    def _take_reading(self) -> EnergyReading:
        """Take a single energy reading."""
        reading = EnergyReading(timestamp=time.time())

        # CPU monitoring -- always a TDP-based estimate; no RAPL/hardware
        # CPU power access is used here.
        reading.cpu_utilization = psutil.cpu_percent()
        reading.cpu_power_watts = (reading.cpu_utilization / 100) * settings.CPU_TDP_WATTS

        # RAM monitoring -- flat per-GB heuristic, also an estimate.
        ram = psutil.virtual_memory()
        reading.ram_used_mb = ram.used / (1024 ** 2)
        ram_gb = ram.used / (1024 ** 3)
        reading.ram_power_watts = ram_gb * self.RAM_POWER_PER_GB_WATTS

        # GPU monitoring -- real NVML wattage when available, otherwise an
        # explicitly labeled idle-watts estimate. These two cases are never
        # blended without the reading itself recording which one occurred.
        if self.nvml_available and self.gpu_handle:
            try:
                import pynvml

                power_mw = pynvml.nvmlDeviceGetPowerUsage(self.gpu_handle)
                reading.gpu_power_watts = power_mw / 1000
                reading.gpu_power_source = "nvml_real"

                util = pynvml.nvmlDeviceGetUtilizationRates(self.gpu_handle)
                reading.gpu_utilization = util.gpu

                mem = pynvml.nvmlDeviceGetMemoryInfo(self.gpu_handle)
                reading.gpu_memory_mb = mem.used / (1024 ** 2)

                reading.gpu_temp_c = pynvml.nvmlDeviceGetTemperature(
                    self.gpu_handle, pynvml.NVML_TEMPERATURE_GPU
                )
            except Exception as e:
                logger.warning(f"NVML read failed mid-monitoring, falling back to idle estimate: {e}")
                reading.gpu_power_watts = self.GPU_IDLE_WATTS
                reading.gpu_power_source = "idle_estimate"
        else:
            reading.gpu_power_watts = self.GPU_IDLE_WATTS
            reading.gpu_power_source = "idle_estimate"

        reading.total_power_watts = (
            reading.cpu_power_watts +
            reading.gpu_power_watts +
            reading.ram_power_watts
        )

        return reading

    def stop(self) -> Dict[str, Any]:
        """Stop monitoring and return aggregated results."""
        self.is_monitoring = False
        if self._monitor_thread is not None:
            # Join before touching self.readings -- the monitor thread may
            # still be mid-append otherwise, which previously raced with
            # the sum()/len() calls below (unsynchronized list mutation
            # across threads).
            self._monitor_thread.join(timeout=max(1.0, settings.ENERGY_MEASUREMENT_INTERVAL * 3))
        self.end_time = time.time()

        # Stop CodeCarbon -- use only its public stop() return value
        # (total emissions, kg CO2) rather than reaching into a private
        # `_total_energy` attribute, whose type/presence is not a stable
        # public API and has changed across CodeCarbon versions.
        codecarbon_carbon = 0.0
        if self.codecarbon_available and self.tracker:
            try:
                emissions = self.tracker.stop()
                codecarbon_carbon = emissions or 0.0
            except Exception as e:
                logger.warning(f"Error stopping CodeCarbon: {e}")

        with self._readings_lock:
            readings_snapshot = list(self.readings)

        if not readings_snapshot:
            return self._empty_result()

        duration = self.end_time - self.start_time

        avg_power = sum(r.total_power_watts for r in readings_snapshot) / len(readings_snapshot)
        peak_power = max(r.total_power_watts for r in readings_snapshot)

        avg_cpu_power = sum(r.cpu_power_watts for r in readings_snapshot) / len(readings_snapshot)
        avg_gpu_power = sum(r.gpu_power_watts for r in readings_snapshot) / len(readings_snapshot)
        avg_ram_power = sum(r.ram_power_watts for r in readings_snapshot) / len(readings_snapshot)

        # Energy = Power x Time (convert to Joules). total_energy is a sum
        # of a real (if NVML available) GPU term and estimated CPU/RAM
        # terms -- it is NOT a pure hardware measurement even when GPU
        # power is real; see gpu_energy_source below for what part, if
        # any, is real.
        total_energy = avg_power * duration
        cpu_energy = avg_cpu_power * duration
        gpu_energy = avg_gpu_power * duration
        ram_energy = avg_ram_power * duration

        gpu_is_real = any(r.gpu_power_source == "nvml_real" for r in readings_snapshot)

        # Carbon: prefer CodeCarbon's own measured figure; otherwise a
        # rough US-grid-average estimate from our own energy figure.
        if codecarbon_carbon > 0:
            carbon_kg = codecarbon_carbon
        else:
            carbon_kg = (total_energy / 3_600_000) * 0.4

        last = readings_snapshot[-1]

        return {
            "total_energy_joules": total_energy,
            "cpu_energy_joules": cpu_energy,
            "gpu_energy_joules": gpu_energy,
            "ram_energy_joules": ram_energy,
            "cpu_energy_source": "tdp_proxy_estimate",
            "gpu_energy_source": "nvml_real" if gpu_is_real else "idle_estimate",
            "ram_energy_source": "heuristic_estimate",
            "is_gpu_energy_real": gpu_is_real,
            "avg_power_watts": avg_power,
            "peak_power_watts": peak_power,
            "duration_seconds": duration,
            "carbon_kg": carbon_kg,
            "num_readings": len(readings_snapshot),

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
            "cpu_energy_source": "tdp_proxy_estimate",
            "gpu_energy_source": "idle_estimate",
            "ram_energy_source": "heuristic_estimate",
            "is_gpu_energy_real": False,
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
            "gpu_temp_c": reading.gpu_temp_c,
            "gpu_power_source": reading.gpu_power_source
        }


# Singleton instance
energy_monitor = EnergyMonitor()
