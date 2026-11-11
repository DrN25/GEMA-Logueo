"""Sample an audit worker or an already running backend at 50 ms."""
import argparse
import csv
import json
from pathlib import Path
import subprocess
import time

import psutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--interval", type=float, default=0.05)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if bool(args.pid) == bool(command) or args.interval <= 0:
        parser.error("Provide --pid or a command after --, and a positive interval")
    args.output.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    worker = None
    peak = peak_os = peak_tree = samples = 0
    first = None
    largest_rss = largest_os_peak = 0
    last_cpu = 0.0
    status = "exited"
    with ((args.output / "worker.log").open("wb") as log,
          (args.output / "samples.csv").open("w", newline="", encoding="utf-8") as samples_file):
        writer = csv.writer(samples_file)
        writer.writerow(("elapsed_s", "pid", "rss_bytes", "tree_rss_bytes",
                         "peak_working_set_bytes", "private_bytes", "cpu_seconds",
                         "largest_process_pid", "largest_process_rss_bytes", "tree_cpu_seconds"))
        if command:
            worker = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        pid = args.pid or worker.pid
        try:
            proc = psutil.Process(pid)
            while worker is None or worker.poll() is None:
                tick = time.monotonic()
                try:
                    mem = proc.memory_info()
                    cpu = proc.cpu_times()
                    tree = mem.rss
                    largest = mem
                    largest_pid = pid
                    tree_cpu = cpu.user + cpu.system
                    for child in proc.children(recursive=True):
                        try:
                            child_mem = child.memory_info()
                            tree += child_mem.rss
                            if child_mem.rss > largest.rss:
                                largest, largest_pid = child_mem, child.pid
                            child_cpu = child.cpu_times()
                            tree_cpu += child_cpu.user + child_cpu.system
                        except psutil.NoSuchProcess:
                            pass
                except (psutil.NoSuchProcess, psutil.ZombieProcess):
                    break
                if first is None:
                    first = mem.rss
                os_peak = getattr(mem, "peak_wset", 0)
                peak, peak_tree, peak_os = max(peak, mem.rss), max(peak_tree, tree), max(peak_os, os_peak)
                largest_rss = max(largest_rss, largest.rss)
                largest_os_peak = max(largest_os_peak, getattr(largest, "peak_wset", 0))
                last_cpu = max(last_cpu, tree_cpu)
                writer.writerow((round(tick - started, 4), pid, mem.rss, tree,
                                 os_peak, getattr(mem, "private", ""), cpu.user + cpu.system,
                                 largest_pid, largest.rss, tree_cpu))
                samples += 1
                samples_file.flush()
                time.sleep(max(0, args.interval - (time.monotonic() - tick)))
        except KeyboardInterrupt:
            status = "interrupted"
            if worker and worker.poll() is None:
                worker.terminate()
        exit_code = worker.wait() if worker else None
    phases = {}
    with (args.output / "worker.log").open(encoding="utf-8", errors="replace") as log:
        for line in log:
            fields = line.split()
            if len(fields) == 3 and fields[0] == "BENCHMARK":
                phases[fields[1]] = float(fields[2]) - started
    ready_rss = None
    if "ready" in phases:
        with (args.output / "samples.csv").open(newline="", encoding="utf-8") as source:
            ready = min(csv.DictReader(source),
                        key=lambda row: abs(float(row["elapsed_s"]) - phases["ready"]),
                        default=None)
            if ready:
                ready_rss = int(ready["largest_process_rss_bytes"])
    (args.output / "summary.json").write_text(json.dumps({
        "pid": pid, "first_sample_rss_bytes": first, "peak_rss_bytes": peak,
        "peak_working_set_bytes": peak_os or None, "peak_tree_rss_bytes": peak_tree,
        "elapsed_seconds": time.monotonic() - started, "samples": samples,
        "largest_process_peak_rss_bytes": largest_rss,
        "largest_process_peak_working_set_bytes": largest_os_peak or None,
        "ready_rss_bytes": ready_rss, "observed_tree_cpu_seconds": last_cpu, "phases_seconds": phases,
        "interval_seconds": args.interval, "status": status, "exit_code": exit_code,
    }, indent=2), encoding="utf-8")
    return exit_code or 0


if __name__ == "__main__":
    raise SystemExit(main())
