# Results
```powershell
> npm run bench

> bench
> node bench.js

Generated 50 shared components in src/
run 1/3  diagnostics-threadsnotset  26.90s  exit 0  errors 0  peak heap 388 MiB used
run 1/3  legacy                     14.82s  exit 0  errors 0  peak heap 254 MiB used
run 2/3  diagnostics-threadsnotset  24.56s  exit 0  errors 0  peak heap 379 MiB used
run 2/3  legacy                     14.62s  exit 0  errors 0  peak heap 266 MiB used
run 3/3  diagnostics-threadsnotset  23.72s  exit 0  errors 0  peak heap 383 MiB used
run 3/3  legacy                     14.83s  exit 0  errors 0  peak heap 266 MiB used

Average of 3 runs:
diagnostics-threadsnotset  25.06s (23.72-26.90)
legacy                     14.76s (14.62-14.83)
```