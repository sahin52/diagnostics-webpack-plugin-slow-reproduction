const mebibytes = bytes => Math.round(bytes / (1024 * 1024));

class MemoryUsageWebpackPlugin {
    apply(compiler) {
        const sample = () => {
            this.peak = Math.max(this.peak, process.memoryUsage().heapUsed);
        };
        compiler.hooks.compile.tap('MemoryUsageWebpackPlugin', () => {
            this.peak = 0;
            sample();
            this.timer = setInterval(sample, 100).unref();
        });
        compiler.hooks.done.tap('MemoryUsageWebpackPlugin', () => {
            clearInterval(this.timer);
            sample();
            console.info(`Memory usage: peak heap ${mebibytes(this.peak)} MiB used`);
        });
    }
}

module.exports = MemoryUsageWebpackPlugin;