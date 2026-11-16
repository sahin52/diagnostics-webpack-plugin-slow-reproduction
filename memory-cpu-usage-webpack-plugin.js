const v8 = require('v8');
const os = require('os');

const mebibytes = bytes => Math.round(bytes / (1024 * 1024));
const seconds = microseconds => (microseconds / 1e6).toFixed(1);

const logicalCores = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;

// Note: process.cpuUsage() covers this process and its worker threads, but not
// child processes (ForkTsChecker's type checker, the sass-embedded compiler,
// minifier worker processes), so their CPU time is not included.
class MemoryCpuUsageWebpackPlugin {
    constructor(options) {
        this.intervalMilliseconds = (options && options.intervalMilliseconds) || 250;
        this.reset();
    }

    reset() {
        // external already includes arrayBuffers, so tracking both would count Buffers twice.
        this.peak = { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };

        // CPU: 100% = one core fully busy for the whole interval.
        this.peakCpuPercent = 0;
        this.startCpu = process.cpuUsage();
        this.startTime = process.hrtime.bigint();
        this.lastCpu = this.startCpu;
        this.lastTime = this.startTime;
    }

    sample() {
        const usage = process.memoryUsage();

        for (const key of Object.keys(this.peak)) {
            this.peak[key] = Math.max(this.peak[key], usage[key]);
        }

        const now = process.hrtime.bigint();
        const cpu = process.cpuUsage();
        const elapsedMicroseconds = Number(now - this.lastTime) / 1000;

        // Ignore very short slices (e.g. the final sample right after a tick):
        // timer resolution makes them noisy and they produce fake spikes.
        if (elapsedMicroseconds >= this.intervalMilliseconds * 500) {
            const usedMicroseconds = (cpu.user - this.lastCpu.user) + (cpu.system - this.lastCpu.system);
            this.peakCpuPercent = Math.max(this.peakCpuPercent, usedMicroseconds / elapsedMicroseconds * 100);
            this.lastCpu = cpu;
            this.lastTime = now;
        }
    }

    apply(compiler) {
        compiler.hooks.compile.tap('MemoryUsageWebpackPlugin', () => {
            this.reset();
            this.sample();
            this.timer = setInterval(() => this.sample(), this.intervalMilliseconds).unref();
        });

        compiler.hooks.done.tap('MemoryUsageWebpackPlugin', () => {
            clearInterval(this.timer);
            this.sample();

            const heapLimit = v8.getHeapStatistics().heap_size_limit;

            const cpu = process.cpuUsage(this.startCpu);
            const wallMicroseconds = Number(process.hrtime.bigint() - this.startTime) / 1000;
            const averageCpuPercent = wallMicroseconds > 0 ? (cpu.user + cpu.system) / wallMicroseconds * 100 : 0;
            const ofMachine = averageCpuPercent / logicalCores;

            console.info(`Memory usage: peak heap ${mebibytes(this.peak.heapUsed)} MiB used / ${mebibytes(this.peak.heapTotal)} MiB reserved of ${mebibytes(heapLimit)} MiB limit, peak off-heap ${mebibytes(this.peak.external)} MiB, peak RSS ${mebibytes(this.peak.rss)} MiB`);
            console.info(`CPU usage: average ${Math.round(averageCpuPercent)}% (${(averageCpuPercent / 100).toFixed(2)} of ${logicalCores} cores, ${Math.round(ofMachine)}% of machine), peak ${Math.round(this.peakCpuPercent)}%, user ${seconds(cpu.user)}s + system ${seconds(cpu.system)}s over ${seconds(wallMicroseconds)}s`);

            // One JSON line for tools (bench.js, Benchmark-Build.ps1) to parse.
            const round1 = value => Math.round(value * 10) / 10;
            console.info('BUILD_METRICS ' + JSON.stringify({
                peakHeapMiB: mebibytes(this.peak.heapUsed),
                heapLimitMiB: mebibytes(heapLimit),
                peakExternalMiB: mebibytes(this.peak.external),
                peakRssMiB: mebibytes(this.peak.rss),
                cpuAvgPercent: round1(averageCpuPercent),
                cpuPeakPercent: round1(this.peakCpuPercent),
                cpuUserSec: round1(cpu.user / 1e6),
                cpuSystemSec: round1(cpu.system / 1e6),
                compileSec: round1(wallMicroseconds / 1e6),
                logicalCores,
            }));
        });
    }
}

module.exports = MemoryCpuUsageWebpackPlugin;