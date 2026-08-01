# -*- coding: utf-8 -*-
"""
Real GPU energy measurement via NVIDIA NVML (pynvml).

Unlike the numpy pilot's TDP-based timing proxy, this samples the GPU's
actual hardware-reported instantaneous power draw (nvmlDeviceGetPowerUsage)
throughout a generation call and integrates it over time to obtain joules.
This is genuine measured hardware energy for the GPU package as a whole
(not a per-process partition -- stated as a limitation in the paper).

Intel RAPL (/sys/class/powercap) is not used because this machine is
Windows without root/Linux access -- RAPL is unavailable here, confirmed.
Any CPU-only fallback path must use the TDP-proxy formula instead (see
run_experiment_real.py) and must be labeled "tdp_proxy_cpu", never
silently substituted for real NVML numbers.
"""
import threading
import time

import numpy as np

_trapz = getattr(np, "trapezoid", None) or np.trapz


class NVMLUnavailable(RuntimeError):
    pass


def self_test(gpu_index=0):
    """Raise loudly if NVML power reads are not actually available."""
    import pynvml
    pynvml.nvmlInit()
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(gpu_index)
        name = pynvml.nvmlDeviceGetName(handle)
        mw = pynvml.nvmlDeviceGetPowerUsage(handle)
        return {"gpu_name": name, "power_watts": mw / 1000.0}
    except Exception as e:
        raise NVMLUnavailable(f"NVML power read failed: {e}") from e
    finally:
        pynvml.nvmlShutdown()


class NVMLPowerSampler:
    """Context manager: samples GPU power on a background thread and
    integrates watts over time (trapezoidal rule) to get joules for
    whatever happens inside the `with` block."""

    def __init__(self, gpu_index=0, sample_interval_s=0.01):
        import pynvml
        self._pynvml = pynvml
        pynvml.nvmlInit()
        self.handle = pynvml.nvmlDeviceGetHandleByIndex(gpu_index)
        self.interval = sample_interval_s
        self._samples = []
        self._stop_event = threading.Event()
        self._thread = None

    def _sample_loop(self):
        while not self._stop_event.is_set():
            t = time.perf_counter()
            try:
                mw = self._pynvml.nvmlDeviceGetPowerUsage(self.handle)
                self._samples.append((t, mw / 1000.0))
            except Exception:
                pass
            time.sleep(self.interval)

    def __enter__(self):
        self._samples = []
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._sample_loop, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *exc):
        self._stop_event.set()
        self._thread.join(timeout=1.0)
        return False

    def joules(self):
        if len(self._samples) < 2:
            return 0.0
        ts = np.array([s[0] for s in self._samples])
        ws = np.array([s[1] for s in self._samples])
        return float(_trapz(ws, ts))

    def mean_watts(self):
        if not self._samples:
            return 0.0
        return float(np.mean([w for _, w in self._samples]))

    def max_watts(self):
        if not self._samples:
            return 0.0
        return float(np.max([w for _, w in self._samples]))

    def n_samples(self):
        return len(self._samples)

    def observed_sample_dt(self):
        if len(self._samples) < 2:
            return None
        ts = [s[0] for s in self._samples]
        diffs = [ts[i + 1] - ts[i] for i in range(len(ts) - 1)]
        return float(np.mean(diffs))

    def close(self):
        try:
            self._pynvml.nvmlShutdown()
        except Exception:
            pass


def tdp_proxy_energy(wall_time, cpu_time, n_cores, tdp_watts):
    """CPU-only fallback, identical formula to run_experiment_numpy.py.
    Explicitly labeled tdp_proxy_cpu wherever used -- never conflated
    with real NVML measurements."""
    f_cpu = min(cpu_time / (wall_time * n_cores), 1.0) if wall_time > 0 else 0.0
    energy_joules = tdp_watts * f_cpu * wall_time
    return energy_joules, f_cpu


if __name__ == "__main__":
    print(self_test())
